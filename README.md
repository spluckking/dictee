# Dictée-Blocs

Application web progressive (PWA) pour aider un enfant de CE2 à apprendre sa liste de mots de la semaine avant la dictée. Elle s'utilise sur tablette Android dans Chrome, au stylet, s'installe sur l'écran d'accueil et fonctionne hors ligne.

- HTML, CSS et JavaScript vanilla : pas de framework, pas d'étape de build.
- Données dans le `localStorage` de la tablette : pas de serveur, pas de compte.
- Univers « monde de blocs » en pixel art original, dessiné par le code.

## Ce que fait l'appli

| Écran | Rôle |
|---|---|
| Accueil | Compte à rebours jusqu'à la dictée, mode du jour proposé, choix libre du mode, « Mon monde », son, espace parent |
| Dictée-flash | Le mot est lu (puis la phrase), l'enfant l'écrit, la correction s'affiche |
| Regarder, cacher, écrire | Le mot s'affiche 3 secondes puis disparaît, l'enfant l'écrit |
| Lettres mélangées | Reconstituer le mot avec des tuiles (toucher ou glisser) |
| Le bon mot | Choisir la bonne orthographe parmi 3 |
| Dictée blanche | Tous les mots une fois, sans indice, score à la fin (proposée la veille) |
| Mon monde | Les blocs gagnés construisent une cabane, puis une maison, puis des châteaux |
| Espace parent | Protégé par une multiplication : liste, jour de dictée, progression, nouvelle semaine |

### Principes d'apprentissage

1. **Récupération active** : le mot n'est jamais visible pendant que l'enfant l'écrit. Après une erreur, l'enfant regarde le mot juste, puis il est caché et l'enfant le réécrit de mémoire.
2. **Boîtes de Leitner (3 boîtes)**, planifiées selon les jours restants avant la dictée (`js/leitner.js`) :
   - réussite sans indice : boîte suivante ; avec indice : le mot reste dans sa boîte ; erreur : retour en boîte 1 et le mot revient 3 mots plus loin dans la séance (2 fois au plus) ;
   - boîte 1 revue chaque jour ; boîte 2 tous les 2 jours si la dictée est dans 4 jours ou plus ; boîte 3 tous les 2 ou 3 jours ;
   - aucune révision n'est planifiée après la veille de la dictée : tout est revu ce jour-là ;
   - les modes de reconnaissance (Le bon mot, Lettres mélangées) ne font pas dépasser la boîte 2.
3. **Feedback immédiat et bienveillant** : la réponse est alignée sur le mot juste (Levenshtein), lettres justes en vert, lettres fausses, manquantes ou en trop en orange. Une erreur d'accent seule affiche « Presque ! Regarde l'accent ». Sinon : « On réessaie ! ». Pas de vie perdue, pas de chrono, pas de son négatif.
4. **Première séance de la semaine** : tous les mots de la liste, en une fois, quel que soit leur nombre. **Ensuite, séances courtes** de révision espacée : 15 mots ou 10 minutes, puis un écran de félicitations. Un mot ajouté en cours de semaine relance une séance complète.
5. **Double codage** : le bouton « Indice » montre la phrase (mot masqué) et les syllabes pendant 3 secondes, et les lit. Un mot réussi avec indice ne monte pas de boîte.

**Mode du jour** (dictée le vendredi) : Le bon mot jusqu'au lundi, Lettres mélangées le mardi, Regarder-cacher-écrire le mercredi, Dictée blanche le jeudi, Dictée-flash le jour même. L'enfant peut toujours choisir un autre mode.

**Récompenses** : chaque mot réussi rapporte un bloc commun (terre, planche, pierre, brique). Un mot qui passe en boîte 2 rapporte un bloc peu commun (verre, charbon, fer, cuivre), et un mot qui passe en boîte 3 un minerai rare (or, rubis, saphir, améthyste). Le monde est conservé d'une semaine à l'autre.

## Structure

```
index.html              une seule page, un <section> par écran
manifest.webmanifest    installation sur l'écran d'accueil
sw.js                   service worker (cache hors ligne, chemins relatifs)
css/style.css           boutons-blocs, panneaux, mise en page portrait et paysage
fonts/                  Press Start 2P, Andika, Playwrite FR Moderne (OFL, en local)
icons/                  icônes PNG générées depuis le pixel art (tools/make-icons.js)
js/align.js             Levenshtein, alignement lettre à lettre, erreur d'accent
js/leitner.js           boîtes, planification, choix des mots, file de séance, mode du jour
js/distractors.js       fausses orthographes plausibles par règles
js/syllables.js         découpage en syllabes pour l'indice
js/store.js             données localStorage, liste d'exemple, nouvelle semaine
js/speech.js            synthèse vocale fr-FR, débit 0,85
js/sound.js             sons Web Audio (bloc, jingle), coupure du son
js/pixel.js             textures, mineur, paysage, plans de construction
js/app.js               écrans et modes de jeu
tests/                  tests unitaires (node:test, aucune dépendance)
```

## Tests

Il faut Node.js 18 ou plus récent, sans aucun paquet à installer :

```
npm test
```

ou `node --test tests/*.test.js`. Les tests couvrent l'alignement et la coloration des erreurs, la logique de Leitner et la planification, la génération de distracteurs et le découpage en syllabes.

Pour essayer l'appli sur l'ordinateur : `python3 -m http.server` dans le dossier, puis ouvrir http://localhost:8000 (le service worker ne marche pas en `file://`).

## Déployer sur GitHub Pages

1. Créer un dépôt public sur GitHub, par exemple `dictee-blocs`, et y pousser ces fichiers sur la branche `main`.
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : Deploy from a branch**, branche `main`, dossier `/ (root)`, puis **Save**.
   En ligne de commande : `gh api -X POST repos/PSEUDO/dictee-blocs/pages -f "source[branch]=main" -f "source[path]=/"`
3. Après une minute, l'appli est en ligne à `https://PSEUDO.github.io/dictee-blocs/`.

Tous les chemins sont relatifs (`./sw.js`, `start_url: "./"`), donc le service worker a pour portée `/dictee-blocs/` et l'appli fonctionne sous ce sous-chemin.

**Après une mise à jour du code**, changer `VERSION` en haut de `sw.js` (par exemple `dictee-blocs-v2`) pour que les tablettes rechargent tout. Les données de l'enfant ne sont pas touchées.

## Installer sur la tablette Android

1. Ouvrir l'adresse de l'appli dans **Chrome**.
2. Attendre que la page soit chargée une fois en entier (elle se met en cache pour le hors-ligne).
3. Menu **⋮** → **Ajouter à l'écran d'accueil** (ou **Installer l'application**) → **Installer**.
4. L'icône Dictée-Blocs apparaît sur l'écran d'accueil. L'appli s'ouvre en plein écran et marche sans Internet.

Toutes les données (liste, progression, monde) restent sur cette tablette. Vider les données de Chrome ou désinstaller l'appli les efface.

## Régler le clavier pour écrire au stylet

L'appli n'a pas de reconnaissance d'écriture : c'est le clavier d'Android qui transforme l'écriture en texte.

### Gboard en écriture manuscrite française

1. **Paramètres Android → Système → Clavier → Clavier à l'écran → Gboard** (selon la tablette : *Gestion générale → Liste et paramètres par défaut des claviers*).
2. **Langues → Français (France)** → cocher la disposition **Écriture manuscrite** → **OK**.
3. Dans l'appli, toucher le champ ; sur le clavier, appuyer sur l'icône 🌐 (globe) jusqu'à voir la zone d'écriture.
4. L'enfant écrit le mot avec le stylet. Après l'avoir écrit, le bouton ↵ (ou « Valider » dans l'appli) envoie le mot.

### Désactiver la correction automatique de Gboard

Dans **Gboard → Correction orthographique** :
- **Correction automatique** : désactivée ;
- **Afficher la bande de suggestions** : désactivée ;
- **Vérification orthographique** : désactivée ;
- **Majuscules automatiques** : désactivée.

Sinon le clavier pourrait corriger les fautes à la place de l'enfant. L'appli désactive déjà ces options sur son champ (`autocomplete`, `autocorrect`, `autocapitalize`, `spellcheck`), mais Gboard ne les respecte pas toujours.

### Samsung avec S Pen

**Paramètres → Fonctions avancées → S Pen → S Pen vers texte** : activer. L'enfant écrit directement dans le champ avec le S Pen. Sur le clavier Samsung, couper aussi **Texte prédictif** et **Correction automatique** dans **Paramètres → Gestion globale → Paramètres du Clavier Samsung**.

**Écriture directe au stylet** (réglage activé par défaut dans l'espace parent) : l'appli ne place pas le curseur dans la case à chaque mot et le clavier virtuel ne s'ouvre pas tout seul. L'enfant écrit directement dans la case avec le stylet. Le bouton ⌨️ affiche le clavier si besoin. Si l'écriture au stylet ne fonctionne pas sur la tablette, décocher ce réglage.

Le clavier peut mal reconnaître une lettre : après chaque saisie, l'appli affiche en gros ce qui a été reconnu avec « C'est ce que j'ai écrit » et « Effacer, je recommence ». Si l'écriture pose problème, le bouton **Tuiles** permet de répondre sans clavier.

## Espace parent

Bouton ⚙️ en haut de l'accueil, puis répondre à la multiplication.

- **Liste** : un mot par ligne, phrase facultative après une barre verticale :
  ```
  chevaux | Les chevaux galopent dans le pré.
  maison
  ```
  La phrase est lue après le mot, comme en dictée.
- **Jour de la dictée** : vendredi par défaut.
- **Progression** : boîte de chaque mot, réussites (dont avec indice), erreurs, erreurs fréquentes, prochaine révision, scores des dictées blanches.
- **Nouvelle semaine** : coller la nouvelle liste, puis « Commencer une nouvelle semaine ». Les mots pas encore en boîte 3 peuvent être gardés en révision. Le monde de l'enfant est conservé.
- **Réglages** : écriture au stylet sans clavier virtuel, écriture cursive (police Playwrite FR Moderne), sons, saisie par défaut (clavier ou tuiles), test de la voix.

Si aucune voix française n'est trouvée : **Paramètres Android → Système → Langues → Synthèse vocale** → moteur Google → installer les données vocales **Français (France)**.

## Crédits et licences

Code : MIT. Pixel art, personnage et sons : créés pour cette appli, générés par le code. Polices : SIL Open Font License, voir `fonts/LICENCES.txt`.
