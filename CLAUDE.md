# Dictée-Blocs — consignes pour Claude

## Le projet
- PWA en JavaScript pur (aucune étape de build) pour aider un enfant de 8 ans (CE2) à apprendre les mots de la dictée de la semaine, avant la dictée du vendredi (jour réglable dans l'espace parent).
- Utilisée sur une tablette Android, dans Chrome, avec un stylet (écriture manuscrite Gboard). Interface en français.
- Données uniquement en localStorage (clé `dicteeMot.v1`, aucun serveur). Univers original en pixel-art de blocs (rien de repris d'un jeu existant).
- Dépôt : spluckking/dictee. En ligne via GitHub Pages (branche main, racine) : https://spluckking.github.io/dictee/
- Toujours répondre en français.

## Structure
- index.html, manifest.webmanifest, css/style.css, sw.js (service worker, chemins relatifs, constante VERSION — actuellement `dictee-blocs-v11`).
- js/ : align, leitner, distractors, syllables, traps, store, audiokey, speech, sound, pixel, app.
- audio/voix/ : voix Denise (Azure, fr-FR-DeniseNeural) enregistrée par `npm run voices` (tools/make-voices.js) : un MP3 par mot, par phrase et par découpage en syllabes, nommé par js/audiokey.js. Débit : mot -10 %, phrase 0 %, syllabes -15 %. Sans fichier, speech.js utilise la synthèse du navigateur.
- audio/sons/ : 7 bruitages ElevenLabs générés par `npm run sounds` (tools/make-sounds.js), listés dans sons.json et dans ASSETS de sw.js ; sound.js égalise leur volume et garde ses sons Web Audio si un fichier manque.
- Clés AZURE_SPEECH_KEY, AZURE_SPEECH_REGION et ELEVENLABS_API_KEY dans .env, ignoré par git : ne jamais les commiter ni les afficher.
- fonts/ : polices auto-hébergées (licence OFL, voir fonts/LICENCES.txt). icons/ : icônes PNG (générées par tools/make-icons.js, `npm run icons`).
- liste.txt : la liste de mots de la semaine.
- Tests : node --test tests/*.test.js (ou `npm test`), à lancer avant chaque push.
- Tout nouveau fichier servi par l'appli doit être ajouté à la liste ASSETS de sw.js (sinon il ne marche pas hors ligne).

## Publier une modification
1. Modifier le code, lancer les tests.
2. Augmenter VERSION dans sw.js (sinon la tablette garde l'ancienne version en cache).
3. Commit + push sur main. GitHub Pages se met à jour en une à deux minutes.
4. Sur la tablette : fermer puis rouvrir l'appli, deux fois, avec internet.

## Workflow hebdomadaire : nouvelle liste
Je t'envoie une photo de la liste de l'enseignante. Tu la transcris dans liste.txt :
- Première ligne : « # Titre » (ex. « # Dictée n°5 : La Préhistoire »). Les autres lignes commençant par « # » sont ignorées.
- Puis une ligne par mot : « mot | phrase de contexte ».
- Noms avec leur article (un, une, le, la, des…) ; l'article est facultatif dans la réponse de l'enfant.
- Verbes à l'INFINITIF seulement : jamais de formes conjuguées, même si la liste indique « (présent) ».
- Une phrase de contexte simple par mot, adaptée à un enfant de CE2.
- Un nom donné au singulier et au pluriel (ex. « un animal / des animaux ») devient deux entrées.
- Pour un verbe pronominal, le « se » est facultatif dans la réponse.
- Montre-moi la transcription pour vérification avant de pousser, puis lance `npm run voices` (enregistre les nouveaux mots, phrases et syllabes ; les tests échouent si une voix manque), bump VERSION + push sur main avec les nouveaux fichiers de audio/voix/.
- Ne pas supprimer les anciens fichiers de audio/voix/ : ils servent aux mots de la mine des souvenirs.
- L'appli vérifie liste.txt à chaque ouverture (empreinte du texte dans state.publishedListId) :
  - titre différent → nouvelle semaine : le monde est conservé, la progression est remise à zéro, et TOUS les mots de l'ancienne liste partent dans la mine (les mots pas encore en boîte 3 y reviennent dès le lendemain, les mots sus après 3 jours) ; un mot repris dans la nouvelle liste sort de la mine ;
  - même titre (liste corrigée) → la progression des mots inchangés est conservée.
  - Toute modification du fichier, même une coquille, déclenche ce contrôle : garder le même titre pour une simple correction.

## Règles d'apprentissage (à respecter)
- Leitner à 3 boîtes ; erreur = retour en boîte 1 ; les modes de reconnaissance (choix, lettres) ne font pas dépasser la boîte 2, sauf le choix parmi 4 de la Révision du jour, qui compte comme un mot écrit (choix de la propriétaire, 17/11/2026) ; un indice = pas de promotion ; « J'hésite » = pas de promotion ; au maximum une promotion de boîte par jour.
- Première séance de la semaine : TOUS les mots, sans limite de nombre ni de temps (découverte par paquets de 5 regroupés par lieu, avec pause possible entre paquets ; fiche d'étude pour chaque mot nouveau). Ensuite, dans les modes d'entraînement : révisions espacées (15 mots ou 10 minutes au plus).
- Le clavier s'ouvre automatiquement à chaque mot (option stylusDirect, désactivée par défaut, pour ne pas l'ouvrir).
- Pas de défilement : tous les boutons doivent rester visibles, en portrait comme en paysage.
- Palais mental : traps.js détecte les pièges d'orthographe et range chaque mot dans un des 8 lieux ; carte mentale « Ma carte des pièges ».

## Règles de récompense
- Phase 1 « Révision du jour » (gros bouton de l'accueil) : TOUS les mots de la semaine chaque jour ; chaque mot se présente d'abord comme un choix parmi 4 orthographes (1 juste, 3 fausses tirées de distractors.js) ; un mot raté est réécrit tout de suite, puis revient à écrire en entier (liste S.daily.write) ; les mots ratés reviennent jusqu'à ce que tout soit juste (la séance peut reprendre plus tard dans la journée) ; ensuite c'est fini pour la journée avec UNE seule récompense (coffre : 1 bloc par mot, rareté selon la boîte), blocs posés dans « Mon monde ».
- Les autres modes de la phase 1 (Dictée-flash, Regarder-cacher-écrire, Lettres mélangées, Le bon mot, Dictée blanche) = entraînement libre, SANS récompense (ils font quand même évoluer les boîtes de Leitner).
- Phase 2 « La mine des souvenirs » (écran séparé, visible dès qu'il y a d'anciens mots) : toutes les anciennes listes mélangées, espacement propre à chaque mot (intervalle × facilité ; le lendemain si raté), mot retiré quand il est vraiment su (série ≥ 4 et prochain intervalle ≥ 45 jours) et placé dans la salle des trophées.
- « Expédition du jour » : uniquement les mots dus (10 au maximum, figés au premier départ), à répéter jusqu'à ce que tout soit juste, une fois par jour. Les réussites ne creusent pas de bloc ; la seule récompense est le trésor de la semaine (semaine commençant le lundi), donné à la fin de la première expédition terminée de la semaine : la mine descend de 5 blocs et le trésor y est posé à la profondeur atteinte. Les trésors arrivent dans un ordre fixe (lanterne, champignon lumineux, fossile, coffre, géode, wagonnet, statue d'or, œuf de pierre, couronne, puis des géodes géantes).
- « S'entraîner » dans la mine : 10 mots au hasard, 1 bloc creusé par bonne réponse, sans effet sur la mémoire des mots.
- Ne jamais ajouter de moyen de « farmer » des récompenses.
