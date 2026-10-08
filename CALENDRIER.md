# Actualisation du calendrier

Les données sont récupérées directement sur `https://api.ffbb.app` avec
[ffbb-api-client-v2 1.4.0](https://pypi.org/project/ffbb-api-client-v2/).
Le service intermédiaire Desimone n’est plus utilisé. Aucun HTML n’est extrait.
`TokenManager` récupère les jetons depuis la configuration publique FFBB ;
aucun jeton n’est exporté dans le site. Les variables facultatives
`API_FFBB_APP_BEARER_TOKEN` et `MEILISEARCH_BEARER_TOKEN` permettent de les fournir.
La session de données utilise un cache mémoire avec expiration immédiate.

`data/ffbb-config.json` contient l’adresse du service, l’identifiant numérique du
club (`12343`, code `OCC0031039`) et les libellés courts des équipes déjà connues.
`scripts/ffbb_import.py` récupère les saisons actives et toutes les rencontres où
le club figure à domicile ou à l’extérieur via `list_all_rencontres`.
Les scores sont présents directement sur ces rencontres. Les engagements sont
l’union de ceux de la fiche club et de ceux des matchs. Certaines anciennes
phases ne figurent plus dans la collection des engagements : leurs matchs restent
importés grâce aux identifiants de club, d’engagement et de compétition du match.
Les métadonnées annexes supprimées ou non publiées (HTTP 403/404 sur compétition,
salle ou poule) ne masquent pas les scores accessibles. Elles restent vides et
signalées dans `warnings` ; les classements concernés portent `available: false`.
Les autres erreurs, notamment réseau, authentification 401 et serveur, bloquent l’import.

Toutes les compétitions retournées pour le club sont incluses, y compris les
coupes. Les classements disponibles sont conservés dans le JSON pour une future
présentation. Les libellés longs proviennent de l’API ; les libellés courts peuvent
être ajustés dans `teamLabels` sans modifier le HTML.

La page équipes utilise la liste `displayTeams` de la configuration : une entrée
par équipe réelle, avec son nom, sa catégorie et l’identifiant de son engagement
principal, facultatif, pour le lien FFBB. Sans identifiant ou correspondance dans
l’API, l’équipe reste affichée sans lien. Conserver les libellés historiques et
les jeunes de U13 à U18, même sans compétition retrouvée. Les U11 sont dans l’école
de basket. Elle n’affiche pas les compétitions ni les engagements
supplémentaires en coupe. Actualiser cette liste si les équipes du club changent.

Depuis le dossier du site, avec Node.js 22+, Python 3.10+ et un accès Internet,
installer les dépendances sous Windows puis lancer l’import :

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-ffbb.in
node scripts/update-calendar.mjs
.\.venv\Scripts\python.exe -m unittest discover -s scripts -p "test_*.py"
node --test scripts/calendar.test.mjs scripts/permanences.test.mjs
```

Sous Linux/macOS, utiliser `.venv/bin/python` pour installer les dépendances et
exécuter les tests Python. Le lanceur Node choisit le Python de `.venv` s’il existe,
sinon `python` du PATH. `FFBB_PYTHON` permet de préciser un autre chemin.
Le site reste statique : son affichage ne nécessite pas Python.

Publier `data/calendar.json`, `data/calendar-data.js`, `equipes.html` et les
scripts de navigateur avec le site. `calendar.json` est la source de données ;
le fichier JS est une copie générée pour l’ouverture locale sans serveur.
Sur un hébergement web, le calendrier recharge le JSON sans cache et utilise la
copie JS en secours. Les liens de la page équipes sont aussi générés depuis les
données API. `node scripts/export-calendar.mjs` régénère ces fichiers sans réseau.

L’import vérifie le club, la saison, les doublons, les dates et les statuts avant
d’enregistrer les données. La pagination Directus est triée par identifiant et
chaque page est vérifiée contre `meta.filter_count`. Une réponse tronquée ou une
erreur de récupération conserve l’instantané précédent. Le lanceur Node remplace
le JSON seulement après un import complet, puis génère la copie JS et les liens.

Les horaires sans fuseau FFBB sont déjà en heure française ; les horaires avec
fuseau sont convertis en `Europe/Paris`. Le statut `joue`
détermine si un score peut être affiché : les faux 0–0 futurs sont masqués, les
vrais scores nuls conservés. Les scores absents ou `None` restent indisponibles.
Le lien individuel FFBB du match est utilisé lorsqu’il est disponible, sinon le
lien officiel de l’engagement ou du club.

Le logo de chaque club rencontré est lu une fois par import via `get_organisme`
et enregistré par son UUID (`homeLogo`, `awayLogo`). Les logos sont décoratifs :
une erreur de lecture devient un avertissement et ne bloque jamais les scores.
Le navigateur charge une miniature publique depuis `https://api.ffbb.app/assets/`
et affiche les initiales du club si le logo manque.

La date d’import figure sous le calendrier. Après 48 heures, un message indique
que des résultats récents peuvent manquer.

## Actualisation programmée

Le workflow `.github/workflows/update-ffbb.yml` prévoit sur GitHub Actions :
deux imports par jour (07 h et 19 h UTC) et lancement manuel possible.
Il installe Node, Python et le client, teste l’importateur, importe puis vérifie les
données avant de versionner les fichiers générés. Les modifications locales du
workflow doivent être poussées pour être utilisées par GitHub Actions.
La publication vers l’hébergement doit suivre l’actualisation du dépôt. Avec
GitHub Pages, un commit du jeton Actions ne déclenche pas à lui seul un nouveau
déploiement : raccorder la publication du site au workflow selon l’hébergement.
