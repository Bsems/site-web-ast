# Actualisation du calendrier

Les données sont récupérées en JSON via l’API publique intermédiaire
[FFBB Data Client](https://ffbb-api.desimone.fr/docs), hébergée par Desimone.
Ce service est distinct du domaine direct `api.ffbb.com`, qui refuse actuellement
les lectures anonymes. Aucun jeton n’est nécessaire pour le service configuré.
L’ancien extracteur des pages HTML/React FFBB a été supprimé.

`data/ffbb-config.json` contient l’adresse du service, l’identifiant numérique du
club (`12343`, code `OCC0031039`) et les libellés courts des équipes déjà connues.
Les engagements sont découverts via `/api/v1/club/12343/teams`, les rencontres via
`/api/v1/club/12343/matches`, puis les scores via `/api/v1/poule/{id}`.
Le calendrier du club ne fournit pas les scores : les deux réponses sont
rapprochées par identifiant de rencontre, jamais par nom d’adversaire.

Toutes les compétitions retournées pour le club sont incluses, y compris les
coupes. Les classements disponibles sont conservés dans le JSON pour une future
présentation. Les libellés longs proviennent de l’API ; les libellés courts peuvent
être ajustés dans `teamLabels` sans modifier le HTML.

La page équipes utilise la liste `displayTeams` de la configuration : une entrée
par équipe réelle, avec son nom, sa catégorie et l’identifiant de son engagement
principal, facultatif, pour le lien FFBB. Sans identifiant ou correspondance dans
l’API, l’équipe reste affichée sans lien. Conserver les libellés historiques et
les jeunes de U11 à U18, même sans compétition retrouvée. Elle n’affiche pas les compétitions ni les engagements
supplémentaires en coupe. Actualiser cette liste si les équipes du club changent.

Depuis le dossier du site, avec Node.js 22 ou plus récent et un accès Internet :

```sh
node scripts/update-calendar.mjs
node --test scripts/calendar.test.mjs scripts/ffbb-api.test.mjs
```

Publier `data/calendar.json`, `data/calendar-data.js`, `equipes.html` et les
scripts de navigateur avec le site. `calendar.json` est la source de données ;
le fichier JS est une copie générée pour l’ouverture locale sans serveur.
Sur un hébergement web, le calendrier recharge le JSON sans cache et utilise la
copie JS en secours. Les liens de la page équipes sont aussi générés depuis les
données API. `node scripts/export-calendar.mjs` régénère ces fichiers sans réseau.

L’import vérifie le club, les nombres d’enregistrements, les doublons, les dates,
les statuts et la présence de chaque rencontre dans sa poule avant d’enregistrer
les données. Une erreur de récupération ou de validation conserve l’instantané
précédent. Les collections ne sont plus lues directement et aucune pagination
Directus n’est utilisée : les routes documentées renvoient les listes complètes.

Les horaires sont conservés en heure locale française. Le statut `joue` (0/1)
détermine si un score peut être affiché : les faux 0–0 futurs sont masqués, les
vrais scores nuls conservés. Les scores absents ou `None` restent indisponibles.
Les liens des rencontres renvoient à la page officielle de l’engagement FFBB,
car l’API ne fournit pas de lien de fiche individuelle.

La date d’import figure sous le calendrier. Après 48 heures, un message indique
que des résultats récents peuvent manquer.

## Actualisation programmée

Le workflow `.github/workflows/update-ffbb.yml` est prêt pour GitHub Actions :
deux imports par jour (07 h et 19 h UTC) et lancement manuel possible.
Il teste les données avant de versionner les fichiers générés. Il devient actif
une fois publié sur la branche par défaut, si Actions et l’écriture du dépôt sont
autorisés. Il n’a pas été publié ni activé par cette modification locale.
La publication vers l’hébergement doit suivre l’actualisation du dépôt. Avec
GitHub Pages, un commit du jeton Actions ne déclenche pas à lui seul un nouveau
déploiement : raccorder la publication du site au workflow selon l’hébergement.
