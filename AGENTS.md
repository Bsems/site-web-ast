# Règles de contenu du projet AST

- Les fichiers `.txt` sont réservés aux textes à afficher sur le site.
- Exception demandée par l’utilisateur : `BACKLOG.txt` sert au suivi interne des travaux à faire plus tard. Y consigner les fonctionnalités reportées.
- Les fichiers `.json` sont la source de référence pour les liens et les autres informations structurées (coordonnées, dates, horaires, moyens de paiement, etc.).
- Ne pas maintenir les liens manuellement dans les TXT. Alimenter les pages depuis les JSON, directement ou par génération du HTML pour préserver l’ouverture locale sans serveur.
- Pour l’inscription : textes dans `Texte/Inscriptions_AST_source.txt`, données dans `data/inscriptions-source.json`. Après modification des données, exécuter `node scripts/export-inscriptions.mjs` et versionner le HTML actualisé.
- Ne pas ajouter d’années dans le contenu affiché de la rubrique inscription.
- FFBB : utiliser l’API documentée dans `data/ffbb-config.json`, jamais extraire les pages HTML. `data/calendar.json` est la source ; `calendar-data.js` et les listes de `equipes.html` sont générés. Voir `CALENDRIER.md`.
- La page équipes présente uniquement les équipes du club, une fois chacune, selon `displayTeams` dans `data/ffbb-config.json`. Les engagements en coupe ou autres compétitions ne sont pas des équipes supplémentaires ; ils restent dans les données du calendrier.
- Conserver les jeunes de U13 à U18 et les anciens libellés (NF U18 Élite, RF U15, etc.), ainsi que les séniors NF2, RF2, DF3, RM3 et DM3. Les U11 sont présentés dans l’école de basket, pas dans la catégorie Jeunes, conformément à la demande de l’utilisateur. Une équipe sans correspondance FFBB reste affichée sans lien ; ne pas la supprimer ni la renommer selon les données disponibles.
