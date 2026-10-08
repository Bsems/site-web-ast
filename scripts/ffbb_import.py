"""Import FFBB direct avec ffbb-api-client-v2, sans extraction HTML.

Ce module ne modifie aucun fichier du site. import_calendar(client, config)
construit un instantané en mémoire ; main() l'émet en JSON sur stdout pour le
lanceur Node. Les diagnostics restent sur stderr et tout échec retourne le code 1.
Le client est injecté dans import_calendar pour permettre les tests hors réseau.
"""
import json
import logging
import sys
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import parse_qs, urljoin, urlparse
from uuid import UUID
from zoneinfo import ZoneInfo

from ffbb_api_client_v2 import FFBBAPIClientV2, TokenManager
from ffbb_api_client_v2.exceptions import FFBBApiError
from ffbb_api_client_v2.utils.cache_manager import CacheConfig
from ffbb_api_client_v2.utils.retry_utils import RetryConfig, TimeoutConfig
from requests_cache import CachedSession

ROOT = Path(__file__).resolve().parents[1]
MAX_ITEMS = 10000


def fetch_detail(method, item_id, warnings, **kwargs):
    """Lire une métadonnée annexe ; seuls HTTP 403/404 deviennent un avertissement.

    Réservé aux compétitions, salles et poules : ne pas appliquer cette tolérance
    aux rencontres, saisons ou engagements qui définissent la couverture du club.
    """
    name = getattr(method, '__name__', 'FFBB')
    try:
        return method(item_id, **kwargs)
    except FFBBApiError as error:
        if error.status_code not in (403, 404):
            raise
        # Les matchs restent publiés après la disparition de certaines relations.
        warnings.append(f'{name}({item_id}) : métadonnées indisponibles (HTTP {error.status_code})')
        return None
    except Exception as error:
        raise ValueError(f'{name}({item_id}) : {error}') from error


def validate_response(response, **kwargs):
    """Refuser une page Directus tronquée au lieu de la confondre avec la fin."""
    parsed = urlparse(response.url)
    if response.status_code != 200 or not parsed.path.startswith('/items/'):
        return
    payload = response.json()
    if not isinstance(payload, dict) or 'data' not in payload:
        raise ValueError('Réponse Directus invalide')
    query = parse_qs(parsed.query)
    if 'meta' in query:
        total = payload.get('meta', {}).get('filter_count')
        rows = payload['data']
        offset = int(query.get('offset', ['0'])[0])
        limit = int(query['limit'][0])
        if type(total) is not int or not isinstance(rows, list) or len(rows) != min(limit, max(0, total - offset)):
            raise ValueError('Page Directus incomplète')


def identifier(value):
    """Normaliser l'identifiant numérique en chaîne, format commun des jointures."""
    text = str(value)
    if not text.isdigit():
        raise ValueError(f"Identifiant FFBB invalide : {text}")
    return text


def local_date(value):
    """Produire l'heure civile française YYYY-MM-DDTHH:MM:SS, ou None.

    Une date naïve FFBB est déjà locale ; une date avec fuseau est convertie avant
    de retirer ce fuseau. Ajouter ensuite un Z dans le JSON déplacerait les matchs.
    """
    if value is None:
        return None
    if not isinstance(value, datetime):
        raise ValueError("Date FFBB invalide")
    # Les dates sans fuseau de Directus sont déjà des heures françaises.
    if value.tzinfo is not None:
        value = value.astimezone(ZoneInfo("Europe/Paris"))
    return value.replace(tzinfo=None).isoformat(timespec="seconds")


def club_side(match, club_id):
    """Retourner (à_domicile, engagement_AST) via les identifiants, jamais les noms."""
    if str(match.idOrganismeEquipe1) == str(club_id):
        return True, identifier(match.idEngagementEquipe1)
    if str(match.idOrganismeEquipe2) == str(club_id):
        return False, identifier(match.idEngagementEquipe2)
    raise ValueError(f"Rencontre hors du club : {match.id}")


def fetch_logos(client, club, organisme_ids, warnings):
    """Associer chaque club à l'identifiant UUID de son logo FFBB, ou None.

    Les logos sont décoratifs : toute erreur devient un avertissement et ne bloque
    jamais l'import des scores. Seul un UUID valide est conservé, car calendar.js
    l'insère dans une URL https://api.ffbb.app/assets/<uuid>.
    """
    logos = {}
    for organisme_id in sorted({str(i) for i in organisme_ids if i is not None}):
        if organisme_id == str(club.id):
            organisme = club
        else:
            try:
                organisme = client.get_organisme(int(organisme_id))
            except Exception as error:
                warnings.append(f'get_organisme({organisme_id}) : logo indisponible ({error})')
                organisme = None
        logo = getattr(organisme, 'logo', None) if organisme and str(organisme.id) == organisme_id else None
        try:
            logos[organisme_id] = str(UUID(str(logo))) if logo else None
        except ValueError:
            logos[organisme_id] = None
    return logos


def normalize_match(match, team, club_id, location, logos=None):
    """Adapter un modèle SDK au contrat lu par calendar.js.

    Les scores restent dans l'ordre domicile/extérieur. Le statut joue contrôle
    leur publication ; None signifie inconnu, tandis que zéro reste un vrai score.
    Les liens de rencontre doivent appartenir au domaine officiel en HTTPS.
    logos associe l'identifiant d'un club à l'UUID de son logo (voir fetch_logos).
    """
    logos = logos or {}
    at_home, team_id = club_side(match, club_id)
    if team_id != team['id'] or not match.nomEquipe1 or not match.nomEquipe2:
        raise ValueError("Équipe de la rencontre invalide")
    if type(match.joue) is not bool:
        raise ValueError(f"Statut joue inconnu : {match.id}")
    def score(value):
        if value is None:
            return None
        if type(value) is not int or value < 0:
            raise ValueError(f"Score FFBB invalide : {match.id}")
        return value
    url = urljoin('https://competitions.ffbb.com', match.url_competition or '')
    if not match.url_competition or urlparse(url).netloc != 'competitions.ffbb.com' or urlparse(url).scheme != 'https':
        url = team['source']
    return {
        'id': identifier(match.id), 'team': team['label'], 'teamId': team_id,
        'date': local_date(match.date_rencontre),
        'home': match.nomEquipe1, 'away': match.nomEquipe2, 'atHome': at_home,
        'homeLogo': logos.get(str(match.idOrganismeEquipe1)),
        'awayLogo': logos.get(str(match.idOrganismeEquipe2)),
        'played': match.joue,
        'homeScore': score(match.resultatEquipe1) if match.joue else None,
        'awayScore': score(match.resultatEquipe2) if match.joue else None,
        'round': match.numeroJournee, 'url': url, 'location': location,
        'competition': team['description'],
        'pouleId': identifier(match.idPoule) if match.idPoule else None,
    }


def import_calendar(client, config):
    """Construire et valider l'instantané complet avant tout enregistrement.

    Étapes : club/saisons, rencontres paginées, engagements, métadonnées, scores,
    classements. Toute exception remonte au lanceur ; aucune sortie partielle
    n'est émise. warnings décrit seulement les métadonnées annexes indisponibles.
    """
    warnings = []
    club_id = config['club']['id']
    club = client.get_organisme(club_id)
    if not club or str(club.id) != str(club_id) or club.code != config['club']['code']:
        raise ValueError("Club FFBB incorrect")
    seasons = client.get_saisons()
    season_ids = {str(s.id) for s in seasons or [] if s.actif}
    if not season_ids:
        raise ValueError("Saison active FFBB absente")
    # Interroger les rencontres du club, et non seulement les engagements listés
    # sur sa fiche : cette relation peut omettre des plateaux ou nouvelles phases.
    raw_matches = client.list_all_rencontres(
        filter_criteria=json.dumps({'_and': [
            {'saison': {'_in': sorted(season_ids)}},
            {'_or': [{'idOrganismeEquipe1': {'_eq': club_id}},
                     {'idOrganismeEquipe2': {'_eq': club_id}}]},
        ]}), sort=['id'], page_size=100, max_items=MAX_ITEMS,
    )
    if not raw_matches or len(raw_matches) >= MAX_ITEMS:
        raise ValueError("Import de rencontres vide ou tronqué")
    if len({identifier(m.id) for m in raw_matches}) != len(raw_matches):
        raise ValueError("Rencontre FFBB dupliquée")
    if any(str(m.saison) not in season_ids for m in raw_matches):
        raise ValueError("Rencontre d'une autre saison")
    # Vérifier l'union des engagements déclarés par le club et vus dans les matchs.
    # Un engagement de la fiche club manquant est bloquant ; un ancien engagement
    # connu seulement par ses matchs peut être reconstruit à l'étape suivante.
    roster_ids = {identifier(i) for i in club.engagements}
    engagement_ids = set(roster_ids)
    engagement_ids.update(club_side(m, club_id)[1] for m in raw_matches)
    engagements = client.list_all_engagements(
        filter_criteria=json.dumps({'id': {'_in': sorted(engagement_ids)}}),
        sort=['id'], page_size=100, max_items=MAX_ITEMS,
    )
    returned_ids = {str(e.id) for e in engagements}
    if len(returned_ids) != len(engagements) or not returned_ids <= engagement_ids or not roster_ids <= returned_ids:
        raise ValueError('Import des engagements incomplet')
    # Certaines anciennes phases ne sont plus dans la collection engagements.
    # Leurs matchs conservent les identifiants de club, engagement et compétition.
    # Conserver ces matchs avec ces seules métadonnées vérifiables.
    for missing_id in sorted(engagement_ids - returned_ids):
        related = [m for m in raw_matches if club_side(m, club_id)[1] == missing_id]
        competition_ids = {m.competitionId for m in related}
        if len(competition_ids) != 1 or None in competition_ids:
            raise ValueError('Compétition de l’ancien engagement ambiguë')
        engagements.append(SimpleNamespace(id=missing_id, idOrganisme=club_id,
            idCompetition=related[0].competitionId, idPoule=related[0].idPoule, numeroEquipe=None))
    # Éviter plusieurs lectures d'une même compétition pendant cet import.
    # Ce cache en mémoire n'est jamais réutilisé par l'actualisation suivante.
    competitions = {}
    teams = {}
    for engagement in engagements:
        if str(engagement.idOrganisme) != str(club_id):
            raise ValueError("Engagement d'un autre club")
        competition_id = engagement.idCompetition
        if competition_id not in competitions:
            competition = fetch_detail(client.get_competition, competition_id, warnings, deep_rencontres_limit=0)
            if competition and (str(competition.id) != str(competition_id) or not competition.nom):
                raise ValueError("Compétition FFBB invalide")
            competitions[competition_id] = competition
        competition = competitions[competition_id]
        if competition and str(competition.saison) not in season_ids:
            continue
        team_id = identifier(engagement.id)
        related = [m for m in raw_matches if club_side(m, club_id)[1] == team_id]
        if not competition and not related:
            raise ValueError('Saison de l’engagement invérifiable')
        match_name = (related[0].nomEquipe1 if club_side(related[0], club_id)[0] else related[0].nomEquipe2) if related else club.nom
        description = competition.nom if competition else None
        teams[team_id] = {
            'id': team_id, 'label': config.get('teamLabels', {}).get(team_id) or description or match_name,
            'description': description,
            'category': ('young' if 'U1' in description.upper() or 'U9' in description.upper() else 'senior') if description else None,
            'number': str(engagement.numeroEquipe) if engagement.numeroEquipe is not None else None,
            'pouleId': identifier(engagement.idPoule) if engagement.idPoule else None,
            'source': f"{config['club']['url']}/equipes/{team_id}" if team_id in returned_ids else config['club']['url'],
            'count': 0,
        }
    # Résoudre chaque salle une fois, puis normaliser les matchs et compter par engagement.
    salles = {}
    for salle_id in sorted({m.salle for m in raw_matches if m.salle}):
        salle = fetch_detail(client.get_salle, salle_id, warnings)
        if salle and str(salle.id) != str(salle_id):
            raise ValueError(f"Salle FFBB invalide : {salle_id}")
        salles[salle_id] = salle.libelle if salle else None
    # Lire une fois le logo de chaque club rencontré, AST compris.
    logos = fetch_logos(client, club, {i for m in raw_matches for i in (m.idOrganismeEquipe1, m.idOrganismeEquipe2)}, warnings)
    matches = []
    for match in raw_matches:
        team_id = club_side(match, club_id)[1]
        if team_id not in teams:
            raise ValueError("Rencontre sans engagement actif")
        team = teams[team_id]
        matches.append(normalize_match(match, team, club_id, salles.get(match.salle), logos))
        team['count'] += 1
    # Les classements sont conservés pour un futur affichage. Leur structure rows
    # dépend des modèles du SDK ; une poule inaccessible est marquée available=False.
    standings = []
    for pool_id in sorted({m['pouleId'] for m in matches if m['pouleId']}):
        pool = fetch_detail(client.get_poule, int(pool_id), warnings, deep_rencontres_limit=0)
        if pool and str(pool.id) != pool_id:
            raise ValueError(f"Poule FFBB invalide : {pool_id}")
        standings.append({'id': pool_id, 'name': pool.nom if pool else None,
                          'available': pool is not None,
                          'rows': [asdict(row) for row in pool.classements or []] if pool else []})
    return {
        'updatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'source': config['club']['url'], 'sourceType': 'api', 'api': config['baseUrl'],
        'client': 'ffbb-api-client-v2', 'clientVersion': '1.4.0',
        'seasonIds': sorted(season_ids),
        'warnings': warnings,
        'teams': sorted(teams.values(), key=lambda t: t['id']),
        'matches': sorted(matches, key=lambda m: (m['date'] or '9999', m['team'], m['id'])),
        'standings': standings,
    }


def main():
    """Configurer le client sans cache persistant et écrire uniquement le JSON final."""
    config = json.loads((ROOT / 'data/ffbb-config.json').read_text(encoding='utf-8'))
    cache = CacheConfig(enabled=False, backend='memory')
    session = CachedSession(backend='memory', expire_after=0)
    # Le hook vérifie aussi les pages internes récupérées par list_all_* du SDK.
    session.hooks['response'].append(validate_response)
    tokens = TokenManager.get_tokens(cache_config=cache)
    client = FFBBAPIClientV2.create(
        api_bearer_token=tokens.api_token, meilisearch_bearer_token=tokens.meilisearch_token,
        cached_session=session, directus_retry_config=RetryConfig(max_attempts=3),
        directus_timeout_config=TimeoutConfig(connect_timeout=10, read_timeout=60),
    )
    # Le client avertit pour des champs annexes que le calendrier n'utilise pas.
    logging.getLogger('ffbb_api_client_v2.utils.converter_utils').setLevel(logging.ERROR)
    data = import_calendar(client, config)
    print(json.dumps(data, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f"Import FFBB impossible : {error}. Données précédentes conservées.", file=sys.stderr)
        sys.exit(1)
