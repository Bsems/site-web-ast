# AST Basket — Site web

Site de l’Association Sportive Tournefeuille Basketball, réalisé en HTML, CSS et
JavaScript. Il propose des pages distinctes pour présenter le club, ses gymnases,
ses équipes et ses partenaires, ainsi qu’un calendrier hebdomadaire des rencontres.

La [documentation technique de maintenance](DOCUMENTATION_TECHNIQUE.md) détaille
l'architecture, chaque programme, les contrats de données, les générateurs,
les tests, la publication et les procédures de diagnostic.

## Consulter le site en local

Ouvrir `index.html` dans un navigateur récent. Aucun serveur, compte, installation
de dépendances ou compilation n’est nécessaire pour consulter le site.

Le calendrier charge un fichier de données local : il fonctionne également en
ouvrant directement `calendrier.html`. Les liens FFBB, les itinéraires Google Maps
et les réseaux sociaux nécessitent une connexion Internet.

Node.js 22+ et Python 3.10+ sont nécessaires uniquement pour actualiser les données
FFBB et exécuter les tests. Les dépendances Python sont dans `requirements-ffbb.in` ;
voir [CALENDRIER.md](CALENDRIER.md) pour leur installation. Aucune dépendance npm.

## Pages et navigation

| Page | Fichier | Contenu |
| --- | --- | --- |
| Accueil | `index.html` | Visuel de bienvenue, accès au club et informations pratiques. |
| Présentation du club | `club.html` | Introduction et chronologie de 1973 à 2015. |
| Nos gymnases | `gymnases.html` | Quatre gymnases, adresses, transports et itinéraires. |
| Les équipes | `equipes.html` | École de basket, Jeunes (U13 à U18) et Séniors ; liens vers les engagements FFBB. |
| École de basket | `ecole-de-basket.html` | Micro-basket, mini-basket et équipes U5 à U11. |
| Basket Santé | `basket-sante.html` | Présentation, séances et médias. |
| Calendrier / Résultats | `calendrier.html` | Rencontres de toutes les équipes regroupées par semaine, puis par jour et horaire. |
| Inscription | `inscription.html` | Démarches, documents, cotisation et permanences. |
| Actualités | `actualites.html` | Emplacements en attente de publications. |
| Événements | `evenements.html` | Page d’attente. |
| Partenaires | `partenaires.html` | Liste des partenaires et accès au contact. |
| Boutique | `boutique.html` | Page d’attente. |
| Contact | `contact.html` | Lien email vers le club. |

Le menu « Le club » s’ouvre au clic et propose « Présentation du club » et
« Nos gymnases ». Le menu principal devient un menu repliable sur les écrans
jusqu’à 1 200 px. La rubrique courante est indiquée dans chaque page.

## Organisation des fichiers

```text
site-web-ast/
├── *.html                    Pages du site
├── styles.css                Styles communs et adaptations mobiles
├── script.js                 Menus de navigation
├── calendar.js               Regroupement et affichage hebdomadaire des matchs
├── data/
│   ├── ffbb-config.json      API, club et libellés des engagements
│   ├── calendar.json         Données sportives de référence
│   └── calendar-data.js      Copie générée pour l’ouverture locale
├── scripts/
│   ├── update-calendar.mjs   Import des rencontres et scores via l’API
│   ├── ffbb_import.py        Import direct via ffbb-api-client-v2
│   ├── export-calendar.mjs   Génération de la copie JS et de la page équipes
│   └── calendar.test.mjs     Tests du calendrier et de l’import
├── Image_AST/                Logos fournis pour le projet
├── Texte/
│   └── Historique_AST.txt    Texte source de la présentation du club
├── CALENDRIER.md             Procédure d’actualisation et dépannage de l’import
└── README.md                 Documentation générale
```

## Modifier le contenu

- Modifier directement le fichier HTML de la rubrique concernée.
- Conserver l’encodage UTF-8 pour les accents.
- Utiliser `styles.css` pour la présentation commune et les règles mobiles.
- L’en-tête et le pied de page sont présents dans chaque fichier HTML : toute
  modification de navigation ou d’identité doit être reportée sur les treize pages.
- Le logo affiché est `Image_AST/AST_logo_L.jpeg`. Conserver les proportions de
  l’image et un texte alternatif ; `main_logo.png` est également fourni dans le dossier.
- La présentation du club reprend `Texte/Historique_AST.txt` : modifier le texte
  source ne régénère pas automatiquement `club.html`.

Les coordonnées affichées sur l’accueil sont : **12 rue Pierre Labitrie,
31170 Tournefeuille**, et **contact@tournefeuillebasket.fr**. Le lien email de
`contact.html` doit rester cohérent avec ces informations.

## Calendrier et résultats FFBB

La page affiche la semaine courante, du lundi au dimanche. Les flèches, le menu
des semaines et le bouton « Cette semaine » permettent de parcourir les rencontres.
Toutes les équipes sont mélangées et les matchs sont triés par jour et horaire.

Chaque rencontre indique la catégorie AST, les adversaires, le lieu de jeu
(domicile ou extérieur), la salle, l’horaire, le score et un lien vers les rencontres FFBB.
Les rencontres sans date sont affichées séparément. Les scores sont présentés
dans l’ordre **équipe à domicile – équipe à l’extérieur**.

Les données sont récupérées directement auprès de la FFBB avec le client Python
[ffbb-api-client-v2](https://pypi.org/project/ffbb-api-client-v2/), version 1.4.0.
Les rencontres de la saison active sont paginées par club, coupes et anciennes
phases comprises. Les scores proviennent directement des rencontres.
Aucune page HTML FFBB n’est extraite.
Pour importer les derniers horaires et résultats depuis la racine du projet :

```sh
node scripts/update-calendar.mjs
node --test scripts/calendar.test.mjs scripts/permanences.test.mjs
```

Publier ensuite `data/calendar.json`, sa copie générée `data/calendar-data.js`
et `equipes.html`. La page indique la date du dernier import et signale les données
de plus de deux jours. La procédure complète est décrite dans [CALENDRIER.md](CALENDRIER.md).

`data/ffbb-config.json` est la configuration de référence. Les listes de la page
équipes sont générées depuis `displayTeams`, avec les liens issus des données API ;
ne pas les modifier à la main. Chaque équipe figure une seule fois, sans liste de
compétitions. Les engagements en coupe restent disponibles dans le calendrier.
Les classements disponibles sont conservés dans le JSON pour une future présentation.
Le workflow GitHub Actions prévoit deux imports quotidiens avec Node et Python.
La mise à jour de l’hébergement doit suivre celle du dépôt ; voir `BACKLOG.txt`.

## Vérifier les modifications

```sh
node --check script.js
node --check calendar.js
node --check scripts/update-calendar.mjs
node --test scripts/calendar.test.mjs scripts/permanences.test.mjs
python -m unittest discover -s scripts -p "test_*.py"
git diff --check
```

Les tests Python nécessitent l’environnement décrit dans `CALENDRIER.md`.
Les tests couvrent les semaines à cheval sur deux années, le tri de plusieurs
équipes, les statuts et scores, les erreurs API, les imports incomplets et la
cohérence entre le JSON et sa copie locale. Un score historique sert de contrôle
d’orientation domicile/extérieur : adapter ce cas lors d’un changement de saison.

Dans le navigateur, vérifier aussi la navigation, le menu « Le club », l’affichage
sur mobile, les semaines sans match, les scores et les liens de chaque rubrique.

## Publication

Le site peut être servi par un hébergement statique. Publier les fichiers HTML,
les cinq CSS, les quatre JS de navigateur, le dossier `data/` et les images utilisées
dans `Image_AST/` et `Partenaires/`, en conservant leur arborescence et la casse des noms.
La liste et la procédure de publication sont dans la documentation technique.

Les scripts d’import sont exécutés localement ; ils ne nécessitent aucun serveur
Node.js sur l’hébergement. Le dépôt Git conserve les sources et l’instantané FFBB.


## Sources du contenu

- Histoire : fichier `Texte/Historique_AST.txt` fourni pour le projet.
- Gymnases : [site actuel du club](https://tournefeuillebasket.fr/nos-gymnases/),
  avec adresses et transports confirmés par le responsable du projet.
- Équipes, poules, calendriers et scores : [FFBB Compétitions](https://competitions.ffbb.com/ligues/occ/comites/0031/clubs/occ0031039).
- Partenaires : [site actuel du club](https://tournefeuillebasket.fr/nos-partenaires/).

## Logos et liens des partenaires

La page `partenaires.html` affiche les 22 partenaires de `data/partners.json`.
Chaque carte présente le logo, puis les liens au verso au clic, au toucher ou
avec Entrée/Espace. Un clic sur le verso en dehors des liens ramène au logo,
sans texte de retour affiché. Le retour reste accessible au clavier avec Tab
puis Entrée/Espace, ou avec Échap.
Un lien choisi ouvre un nouvel onglet ; retourner la carte conserve la page.

Pour modifier un partenaire, éditer `name`, `image` et `links` dans le JSON.
Chaque lien contient `label`, `url` (HTTPS) et `enabled` (affiché si true).
Les champs `sources` et `reviewNote` conservent les références de recherche et
les réserves ; ils ne sont pas affichés sur les cartes. Les liens Renault restent
désactivés jusqu’à confirmation du garage. Les liens non trouvés sont omis.

Après chaque modification, exécuter :

```sh
node scripts/export-partners.mjs
```

Cette commande vérifie les images et les liens, puis régénère
`data/partners-data.js` pour l’ouverture directe en file://. Sur un serveur web,
la page charge directement le JSON. Publier aussi `partners.js`, `partners.css`,
les deux fichiers de données et le dossier `Partenaires/` en respectant la casse.
Les liens et informations structurées sont maintenus dans le JSON.

## Textes et données structurées

Les `.txt` sont réservés aux textes à afficher. Les `.json` sont la source de
référence pour les liens et les autres informations structurées du projet.
Cette règle est également consignée dans `AGENTS.md`.

Pour les inscriptions :

- `Texte/Inscriptions_AST_source.txt` contient les textes éditoriaux à reporter dans la page.
- `data/inscriptions-source.json` contient les liens, le contact, les moyens de règlement et les permanences.
- Après modification du JSON, lancer `node scripts/export-inscriptions.mjs`.
  Le script actualise les éléments repérés par `data-registration-link` et
  `data-registration-value` dans `inscription.html`, sans modifier les textes éditoriaux.
- Publier le HTML régénéré, `inscription.css` et `permanences.js`. Le calendrier
  utilise JavaScript et fonctionne sans serveur ; les autres informations restent
  lisibles sans JavaScript. Les modifications du TXT sont reportées manuellement.
- Ne pas ajouter d’années au contenu affiché des inscriptions.

Le calendrier affiche le mois courant et entoure les dates de `permanences` dans
le JSON. Cette liste est vide tant qu’aucune nouvelle permanence n’est annoncée.
Chaque entrée comporte `date` (format YYYY-MM-DD), `start` et `end` (HH:MM), ainsi
que `location`. L’année est conservée dans les données pour identifier une date
sans ambiguïté, mais n’est pas affichée. Après modification, régénérer la page
avec `node scripts/export-inscriptions.mjs`.

Vérification : `node --test scripts/permanences.test.mjs`.
L’interface de gestion des permanences sera définie plus tard : voir `BACKLOG.txt`,
fichier TXT de suivi interne demandé pour les travaux reportés.
