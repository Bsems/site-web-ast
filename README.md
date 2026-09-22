# AST Basket — Site web

Site de l’Association Sportive Tournefeuille Basketball, réalisé en HTML, CSS et
JavaScript. Il propose des pages distinctes pour présenter le club, ses gymnases,
ses équipes et ses partenaires, ainsi qu’un calendrier hebdomadaire des rencontres.

## Consulter le site en local

Ouvrir `index.html` dans un navigateur récent. Aucun serveur, compte, installation
de dépendances ou compilation n’est nécessaire pour consulter le site.

Le calendrier charge un fichier de données local : il fonctionne également en
ouvrant directement `calendrier.html`. Les liens FFBB, les itinéraires Google Maps
et les réseaux sociaux nécessitent une connexion Internet.

Node.js 22 ou plus récent est nécessaire uniquement pour actualiser les données
FFBB et exécuter les tests. Le projet n’utilise aucune dépendance npm.

## Pages et navigation

| Page | Fichier | Contenu |
| --- | --- | --- |
| Accueil | `index.html` | Visuel de bienvenue, accès au club et informations pratiques. |
| Présentation du club | `club.html` | Introduction et chronologie de 1973 à 2015. |
| Nos gymnases | `gymnases.html` | Quatre gymnases, adresses, transports et itinéraires. |
| Les équipes | `equipes.html` | École de basket, Jeunes (U11 à U18) et Séniors ; liens vers les poules FFBB. |
| Calendrier / Résultats | `calendrier.html` | Rencontres de toutes les équipes regroupées par semaine, puis par jour et horaire. |
| Inscription | `inscription.html` | Présentation de la saison et accès à la page Contact. |
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
│   └── calendar-data.js      Dernier instantané FFBB, versionné avec le site
├── scripts/
│   ├── update-calendar.mjs   Import des rencontres depuis les pages publiques FFBB
│   ├── ffbb-source.mjs       Lecture des données structurées des pages FFBB
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
  modification de navigation ou d’identité doit être reportée sur les onze pages.
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
(domicile ou extérieur), l’horaire, le score publié et un lien vers la fiche FFBB.
Les rencontres sans date sont affichées séparément. Les scores sont présentés
dans l’ordre **équipe à domicile – équipe à l’extérieur**.

Les données constituent un **instantané**, sans actualisation automatique.
Pour importer les derniers horaires et résultats depuis la racine du projet :

```sh
node scripts/update-calendar.mjs
node --test scripts/calendar.test.mjs
```

Publier ensuite le fichier `data/calendar-data.js` actualisé. La page indique
la date du dernier import. La procédure complète et les limites du mécanisme
sont décrites dans [CALENDRIER.md](CALENDRIER.md).

La liste des équipes importées provient des liens de poules dans `equipes.html`.
Au changement de saison ou de phase, vérifier les liens sur la
[fiche FFBB du club](https://competitions.ffbb.com/ligues/occ/comites/0031/clubs/occ0031039)
et les actualiser avant l’import. Les équipes ou compétitions absentes de cette
liste ne sont pas incluses dans le calendrier.

## Vérifier les modifications

```sh
node --check script.js
node --check calendar.js
node --check scripts/update-calendar.mjs
node --check scripts/ffbb-source.mjs
node --test scripts/calendar.test.mjs
git diff --check
```

Les tests couvrent les semaines à cheval sur deux années, le tri de plusieurs
équipes, les statuts et scores, la lecture des références FFBB et la cohérence
de l’instantané. Certains contrôles portent sur les dix équipes et une rencontre
connue de septembre 2026 : adapter ces cas lors d’un changement de saison.

Dans le navigateur, vérifier aussi la navigation, le menu « Le club », l’affichage
sur mobile, les semaines sans match, les scores et les liens de chaque rubrique.

## Publication

Le site peut être servi par un hébergement statique. Publier les fichiers HTML,
`styles.css`, `script.js`, `calendar.js`, le dossier `data/` et les images utilisées
dans `Image_AST/`, en conservant leur arborescence et la casse des noms.

Les scripts d’import sont exécutés localement ; ils ne nécessitent aucun serveur
Node.js sur l’hébergement. Le dépôt Git conserve les sources et l’instantané FFBB.
Un envoi Git ne garantit une mise en ligne que si un déploiement est configuré
sur l’hébergement ; ce projet ne contient pas de pipeline de déploiement.

## État actuel et points à compléter

- Les pages Actualités, Événements et Boutique attendent leur contenu définitif.
- L’inscription renvoie vers Contact ; il n’y a pas de formulaire ni de gestion
  des adhésions. Le contact utilise l’application email du visiteur.
- L’École de basket conserve une présentation générale. Aucune équipe U11
  n’est encore renseignée dans la liste des équipes.
- Les partenaires sont affichés sous forme de noms et leurs liens pointent
  vers la page partenaires du site actuel.
- La dernière étape de l’historique fourni est la saison 2014–2015.
- Les résultats nécessitent un nouvel import pour rester à jour. Le format des
  pages publiques FFBB peut évoluer et demander une adaptation du lecteur.

## Sources du contenu

- Histoire : fichier `Texte/Historique_AST.txt` fourni pour le projet.
- Gymnases : [site actuel du club](https://tournefeuillebasket.fr/nos-gymnases/),
  avec adresses et transports confirmés par le responsable du projet.
- Équipes, poules, calendriers et scores : [FFBB Compétitions](https://competitions.ffbb.com/ligues/occ/comites/0031/clubs/occ0031039).
- Partenaires : [site actuel du club](https://tournefeuillebasket.fr/nos-partenaires/).
