"""Tests hors réseau du contrat FFBB et de ses cas de récupération.

Les modèles de rencontre sont ceux du SDK installé ; les réponses du client
sont simulées. Aucun jeton ni accès FFBB n'est nécessaire pour cette suite.
Commande : python -m unittest discover -s scripts -p "test_*.py".
"""
import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace as Obj
from unittest.mock import Mock

from ffbb_api_client_v2.directus_ffbb.models.get_rencontres_response import GetRencontresResponse
from ffbb_api_client_v2.exceptions import FFBBAuthError, FFBBServerError
from ffbb_import import import_calendar, local_date, normalize_match, normalize_standings, pool_reader, validate_response, MAX_ITEMS

CONFIG = {'club': {'id': 12343, 'code': 'OCC0031039', 'url': 'https://competitions.ffbb.com/clubs/ast'},
          'baseUrl': 'https://api.ffbb.app', 'teamLabels': {'10': 'NF2'}}
TEAM = {'id': '10', 'label': 'NF2', 'description': 'Nationale féminine 2',
        'source': CONFIG['club']['url'] + '/equipes/10'}


def match(**changes):
    """Créer un match AST à l'extérieur, surchargeable pour chaque cas limite."""
    values = dict(id='30', date_rencontre=datetime(2026, 10, 3, 20),
                  idOrganismeEquipe1=9, idOrganismeEquipe2=12343,
                  idEngagementEquipe1=90, idEngagementEquipe2=10,
                  nomEquipe1='Adversaire', nomEquipe2='AS TOURNEFEUILLE',
                  resultatEquipe1=0, resultatEquipe2=20, joue=True,
                  numeroJournee='3', idPoule=20, saison=1037, salle=40,
                  competitionId=50,
                  url_competition='/competitions/nf2/match/30')
    return GetRencontresResponse(**(values | changes))


def client():
    """Simuler toutes les lectures nécessaires à un import d'une rencontre."""
    api = Mock()
    # La fiche club ne liste pas cet engagement, mais le match le référence.
    api.get_organisme.return_value = Obj(id='12343', code='OCC0031039', engagements=[])
    api.get_saisons.return_value = [Obj(id='1037', actif=True)]
    api.list_all_rencontres.return_value = [match()]
    api.list_all_engagements.return_value = [Obj(id='10', idOrganisme=12343, idCompetition=50,
                                                idPoule=20, numeroEquipe=1)]
    api.get_competition.return_value = Obj(id='50', nom='Nationale féminine 2', saison=1037)
    api.get_salle.return_value = Obj(id='40', libelle='Gymnase')
    return api


def pool(**changes):
    """Simuler la réponse Directus d'une poule : valeurs textuelles comme l'API."""
    rows = [
        {'position': '2', 'points': '5', 'matchJoues': '3', 'gagnes': '2', 'perdus': '1', 'nuls': '',
         'paniersMarques': '180', 'paniersEncaisses': '170', 'difference': '10',
         'idEngagement': {'id': '10', 'nom': 'AS TOURNEFEUILLE', 'numeroEquipe': '1'},
         'organisme': {'id': '12343', 'logo': '74983c7e-1f1f-4c55-8d28-d4cdc929448a'}},
        {'position': '1', 'points': '6', 'matchJoues': '3', 'gagnes': '3', 'perdus': '0',
         'difference': '-0', 'idEngagement': {'id': '90', 'nom': 'Adversaire', 'numeroEquipe': ''},
         'organisme': {'id': '9', 'logo': None}},
    ]
    return {'id': '20', 'nom': 'Poule A', 'classements': rows} | changes


class ImportTests(unittest.TestCase):
    # Normalisation des résultats, du club et des heures avant leur affichage.
    def test_recent_result_zero_and_home_away(self):
        result = normalize_match(match(), TEAM, 12343, 'Gymnase')
        self.assertEqual((result['homeScore'], result['awayScore']), (0, 20))
        self.assertFalse(result['atHome'])
        self.assertEqual(result['date'], '2026-10-03T20:00:00')
        self.assertEqual(result['url'], 'https://competitions.ffbb.com/competitions/nf2/match/30')

    def test_future_zero_and_missing_scores(self):
        result = normalize_match(match(joue=False, resultatEquipe1=0, resultatEquipe2=0), TEAM, 12343, None)
        self.assertIsNone(result['homeScore'])
        self.assertIsNone(result['awayScore'])
        self.assertIsNone(normalize_match(match(resultatEquipe1=None), TEAM, 12343, None)['homeScore'])

    def test_invalid_status_score_or_club(self):
        for changes in [{'joue': None}, {'resultatEquipe1': -1}, {'idOrganismeEquipe2': 8}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                normalize_match(match(**changes), TEAM, 12343, None)

    def test_local_time_and_timezone_conversion_across_dst(self):
        self.assertEqual(local_date(datetime(2026, 10, 3, 20)), '2026-10-03T20:00:00')
        self.assertEqual(local_date(datetime(2026, 10, 3, 18, tzinfo=timezone.utc)), '2026-10-03T20:00:00')
        self.assertEqual(local_date(datetime(2026, 10, 25, 19, tzinfo=timezone.utc)), '2026-10-25T20:00:00')
        self.assertIsNone(local_date(None))

    def test_discover_engagement_missing_from_club_roster(self):
        # Cas de régression : la liste des équipes seule ne couvre pas tous les matchs.
        api = client()
        data = import_calendar(api, CONFIG)
        self.assertEqual(data['matches'][0]['awayScore'], 20)
        self.assertEqual(data['teams'][0]['count'], 1)
        self.assertEqual(data['standings'][0]['rows'], [])
        self.assertFalse(data['standings'][0]['available'])
        query = json.loads(api.list_all_engagements.call_args.kwargs['filter_criteria'])
        self.assertEqual(query, {'id': {'_in': ['10']}})
        self.assertEqual(api.list_all_rencontres.call_args.kwargs['sort'], ['id'])
        self.assertEqual(api.list_all_rencontres.call_args.kwargs['max_items'], MAX_ITEMS)

    def test_duplicate_wrong_season_empty_or_truncated_matches(self):
        for rows in [[], [match(), match()], [match(saison=1036)], [match()] * MAX_ITEMS]:
            api = client()
            api.list_all_rencontres.return_value = rows
            with self.assertRaises(ValueError):
                import_calendar(api, CONFIG)

    def test_wrong_club_and_missing_engagement(self):
        api = client()
        api.get_organisme.return_value.code = 'AUTRE'
        with self.assertRaisesRegex(ValueError, 'Club'):
            import_calendar(api, CONFIG)
        api = client()
        api.get_organisme.return_value.engagements = ['10']
        api.list_all_engagements.return_value = []
        with self.assertRaisesRegex(ValueError, 'incomplet'):
            import_calendar(api, CONFIG)

    def test_old_engagement_missing_from_collection_keeps_match(self):
        api = client()
        api.list_all_engagements.return_value = []
        data = import_calendar(api, CONFIG)
        self.assertEqual(data['matches'][0]['awayScore'], 20)
        self.assertEqual(data['teams'][0]['id'], '10')

    def test_truncated_pagination_is_rejected(self):
        response = Obj(status_code=200, url='https://api.ffbb.app/items/ffbbserver_rencontres?meta=filter_count&limit=100&offset=100',
                       json=lambda: {'data': [], 'meta': {'filter_count': 201}})
        with self.assertRaisesRegex(ValueError, 'incomplète'):
            validate_response(response)
        response.json = lambda: {'data': [1], 'meta': {'filter_count': 101}}
        validate_response(response)

    def test_removed_metadata_does_not_hide_published_results(self):
        # Tolérer les seuls détails 403/404, tout en conservant les scores publiés.
        api = client()
        for method in [api.get_competition, api.get_salle]:
            method.side_effect = FFBBAuthError(status_code=403)
        data = import_calendar(api, CONFIG, read_pool=lambda pool_id: None)
        self.assertEqual(data['matches'][0]['awayScore'], 20)
        self.assertEqual(data['teams'][0]['label'], 'NF2')
        self.assertIsNone(data['matches'][0]['location'])
        self.assertFalse(data['standings'][0]['available'])
        self.assertEqual(len(data['warnings']), 3)

    def test_metadata_server_error_still_aborts_import(self):
        api = client()
        api.get_competition.side_effect = FFBBServerError(status_code=503)
        with self.assertRaises(FFBBServerError):
            import_calendar(api, CONFIG)

    def test_http_failure_propagates_without_partial_result(self):
        api = client()
        api.list_all_rencontres.side_effect = RuntimeError('HTTP 503')
        with self.assertRaisesRegex(RuntimeError, '503'):
            import_calendar(api, CONFIG)

    def test_club_logos_are_attached_to_each_side(self):
        api = client()
        ast = api.get_organisme.return_value
        ast.logo = '74983c7e-1f1f-4c55-8d28-d4cdc929448a'
        opponent = Obj(id='9', logo='d9fe52b1-582d-490d-b9fa-01ec6ef06946')
        api.get_organisme.side_effect = lambda i: ast if i == 12343 else opponent
        result = import_calendar(api, CONFIG)['matches'][0]
        self.assertEqual(result['homeLogo'], 'd9fe52b1-582d-490d-b9fa-01ec6ef06946')
        self.assertEqual(result['awayLogo'], '74983c7e-1f1f-4c55-8d28-d4cdc929448a')

    def test_missing_invalid_or_failed_logo_never_blocks_scores(self):
        # Un logo absent, mal formé ou inaccessible laisse le match sans logo.
        for opponent in [Obj(id='9', logo=None), Obj(id='9', logo='../evil'), FFBBServerError(status_code=503)]:
            with self.subTest(opponent=opponent):
                api = client()
                ast = api.get_organisme.return_value

                def organisme(i, opponent=opponent):
                    if i == 12343:
                        return ast
                    if isinstance(opponent, Exception):
                        raise opponent
                    return opponent
                api.get_organisme.side_effect = organisme
                result = import_calendar(api, CONFIG)['matches'][0]
                self.assertIsNone(result['homeLogo'])
                self.assertEqual(result['awayScore'], 20)

    def test_standings_are_named_numeric_and_sorted(self):
        data = import_calendar(client(), CONFIG, read_pool=lambda pool_id: pool())
        standing = data['standings'][0]
        self.assertTrue(standing['available'])
        self.assertEqual(standing['name'], 'Poule A')
        first, ast = standing['rows']
        self.assertEqual((first['position'], first['team'], first['logo'], first['isAst']), (1, 'Adversaire', None, False))
        self.assertEqual((ast['team'], ast['points'], ast['draws'], ast['difference']), ('AS TOURNEFEUILLE - 1', 5, 0, 10))
        self.assertEqual(ast['logo'], '74983c7e-1f1f-4c55-8d28-d4cdc929448a')
        self.assertTrue(ast['isAst'])

    def test_invalid_standings_are_rejected(self):
        for rows in [[{'position': ''}], [{'position': 'x'}], [{'position': '1', 'idEngagement': 5}]]:
            with self.subTest(rows=rows), self.assertRaises(ValueError):
                normalize_standings(rows, 12343)
        club_only = normalize_standings([{'position': '1', 'organisme': {'id': '9', 'nom': 'CLUB VOISIN'}}], 12343)
        self.assertEqual((club_only[0]['team'], club_only[0]['engagementId']), ('CLUB VOISIN', None))
        with self.assertRaisesRegex(ValueError, 'Poule'):
            import_calendar(client(), CONFIG, read_pool=lambda pool_id: pool(id='99'))

    def test_pool_reader_tolerates_only_forbidden_or_missing(self):
        def session(status, payload=None):
            response = Mock(status_code=status)
            response.json.return_value = payload
            response.raise_for_status.side_effect = RuntimeError(f'HTTP {status}') if status >= 400 else None
            return Mock(get=Mock(return_value=response))
        self.assertIsNone(pool_reader(session(404), 't', 'https://api.ffbb.app')('20'))
        self.assertEqual(pool_reader(session(200, {'data': pool()}), 't', 'https://api.ffbb.app')('20')['nom'], 'Poule A')
        with self.assertRaisesRegex(RuntimeError, '503'):
            pool_reader(session(503), 't', 'https://api.ffbb.app')('20')
        reader = session(200, {'data': pool()})
        pool_reader(reader, 'secret', 'https://api.ffbb.app/')('20')
        url = reader.get.call_args.args[0]
        self.assertEqual(url, 'https://api.ffbb.app/items/ffbbserver_poules/20')
        self.assertIn('classements.idEngagement.nom', reader.get.call_args.kwargs['params']['fields'])

    def test_external_match_link_falls_back_to_official_team(self):
        result = normalize_match(match(url_competition='https://example.com'), TEAM, 12343, None)
        self.assertEqual(result['url'], TEAM['source'])


if __name__ == '__main__':
    unittest.main()
