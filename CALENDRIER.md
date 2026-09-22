# Actualisation du calendrier

La page `calendrier.html` affiche les rencontres des dix équipes référencées dans
`equipes.html`, regroupées du lundi au dimanche. Les données sont un instantané
FFBB ; elles ne se mettent pas à jour automatiquement dans le navigateur.
La date du dernier import figure sous les rencontres.

Depuis le dossier du site, avec Node.js 22 ou plus récent et un accès Internet :

```sh
node scripts/update-calendar.mjs
node --test scripts/calendar.test.mjs
```

Publier ensuite `data/calendar-data.js` avec les autres fichiers du site.
L'import découvre les fiches des équipes sur la page FFBB du club et les associe
aux poules liées dans `equipes.html`. Après un changement de phase ou de saison,
mettre ces liens à jour avant de relancer l'import.

L'import remplace les données seulement une fois les dix équipes récupérées.
En cas d'échec, l'instantané précédent reste disponible. Un changement du format
public FFBB peut nécessiter une adaptation de `scripts/ffbb-source.mjs`.

Les horaires sans fuseau fournis par la FFBB sont conservés tels qu'ils figurent
sur les fiches de match (heure locale française). Le statut FFBB `joue` détermine
si un score peut être affiché : les 0–0 des matchs à venir sont masqués. Les dates
absentes sont regroupées sous « Dates à confirmer ».

Le fichier de données est chargé comme un script local, pour que le calendrier
fonctionne aussi à l'ouverture directe de `calendrier.html`, sans serveur.
