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
   - réussite sans indice : boîte suivante (une fois par jour au plus) ; avec indice ou « J'hésite » : le mot reste dans sa boîte ; erreur : retour en boîte 1 et le mot revient 3 mots plus loin dans la séance (2 fois au plus) ;
   - boîte 1 revue chaque jour ; boîte 2 tous les 2 jours si la dictée est dans 4 jours ou plus ; boîte 3 tous les 2 ou 3 jours ;
   - aucune révision n'est planifiée après la veille de la dictée : tout est revu ce jour-là ;
   - les modes de reconnaissance (Le bon mot, Lettres mélangées) ne font pas dépasser la boîte 2.
3. **Feedback immédiat et bienveillant** : la réponse est alignée sur le mot juste (Levenshtein), lettres justes en vert, lettres fausses, manquantes ou en trop en orange. Une erreur d'accent seule affiche « Presque ! Regarde l'accent ». Sinon : « On réessaie ! ». Pas de vie perdue, pas de chrono, pas de son négatif.
4. **Déterminant facultatif** : « jungle » est accepté pour « la jungle » (un mauvais déterminant, « le jungle », reste une erreur). Les tuiles portent sur le mot sans son déterminant, toutes sur une ligne, et restent à leur place quand on en prend une.
5. **Première séance de la semaine** : tous les mots de la liste, en une fois, quel que soit leur nombre. **Ensuite, séances courtes** de révision espacée : 15 mots ou 10 minutes, puis un écran de félicitations. Un mot ajouté en cours de semaine relance une séance complète.
6. **Double codage** : le bouton « Indice » montre la phrase (mot masqué) et les syllabes pendant 3 secondes, et les lit. Un mot réussi avec indice ne monte pas de boîte.

### Méthodes de mémorisation mélangées

Sur le principe d'une méthode « multi malin » pour l'orthographe : chaque difficulté a un lieu et une petite règle, et tout est calculé automatiquement à partir des mots, donc ça marche avec n'importe quelle nouvelle liste (`js/traps.js`).

| Méthode | Dans l'appli |
|---|---|
| Répétition espacée | Boîtes de Leitner pendant la semaine, puis mémoire propre à chaque mot dans la mine des souvenirs (phase 2) |
| Rappel actif | Le mot est toujours écrit de mémoire, jamais recopié |
| Auto-évaluation | Après chaque réponse : « 😎 Sûr de moi » ou « 🤔 J'hésite ». Un mot juste mais hésitant ne monte pas de boîte ; un mot faux alors que l'enfant était sûr est signalé |
| Palais mental (lieux) | Chaque type de piège est un lieu du monde : l'île des -tion, le château des lettres muettes, la tour des lettres doubles, le pont du m, le puits du h muet, la grotte des accents, la forêt des sons cachés, la prairie des mots tranquilles. Chaque mot « habite » dans le lieu de son piège principal, rappelé dans l'indice et la correction |
| Fractionnement | Mots découpés en syllabes, pièges colorés selon leur lieu. La découverte se fait par paquets de 5 mots regroupés par lieu, avec une pause possible entre deux paquets |
| Carte mentale | Écran « 🗺️ Ma carte des pièges » : « Mes mots » au centre, une branche par lieu, les mots de la semaine (couleur = boîte) et ceux des semaines passées. Toucher un mot le fait entendre |

**Fiche d'étude** : la première fois qu'un mot apparaît, l'enfant voit sa fiche (mot découpé, pièges colorés, lieu, phrase lue), puis la fiche est cachée et il écrit le mot.

**Une seule montée de boîte par jour et par mot** : c'est l'espacement entre les jours qui fait retenir.

### Phase 2 : la mine des souvenirs

À chaque nouvelle semaine, les mots de la semaine qui se termine descendent dans « la mine des souvenirs », un espace à part, ouvert depuis l'accueil. Tous les mots des semaines passées y sont mélangés et **chacun a sa propre mémoire** (intervalle et facilité, à la manière de SuperMemo/Anki, simplifié) :

- réussi en étant sûr de soi : il revient de plus en plus tard (environ 3 j, 7 j, 16 j, 40 j…) et devient « facile » ;
- réussi en hésitant ou avec l'indice : il revient un peu plus tard seulement et devient un peu plus « difficile » ;
- raté : il revient dès le lendemain et sa facilité baisse, donc il reviendra plus souvent ensuite ;
- après 4 réussites d'affilée et un écart d'au moins 45 jours (au moins 5 semaines au total), il est retiré : « su pour toujours », gravé dans la salle des trophées.

Les actions sont volontairement limitées : une seule activité (dictée-flash avec « Sûr de moi / J'hésite »), une expédition de 10 mots au plus par jour, les mots les plus en retard d'abord, plus une expédition bonus s'il reste des mots en retard. Ensuite la mine est fermée jusqu'au lendemain. Récompense propre à la phase 2 : chaque mot réussi fait creuser d'un bloc (3 pour un mot su pour toujours) ; en descendant, on traverse la terre, la pierre, l'ardoise, la grotte de cristal puis le cœur de magma, et on trouve des trésors (lanterne, fossile, coffre, géode, wagonnet, statue d'or, couronne…).

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
js/traps.js             pièges d'orthographe, lieux (palais mental), morceaux colorés
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

**Clavier automatique** : à chaque mot, l'appli place le curseur dans la case et le clavier (manuscrit) s'ouvre. Pour écrire au stylet directement dans la case sans que le clavier s'ouvre, cocher « Ne pas ouvrir le clavier automatiquement » dans l'espace parent (un bouton ⌨️ permet alors de l'afficher).

Le clavier peut mal reconnaître une lettre : après chaque saisie, l'appli affiche en gros ce qui a été reconnu avec « C'est ce que j'ai écrit » et « Effacer, je recommence ». Si l'écriture pose problème, le bouton **Tuiles** permet de répondre sans clavier.

## Liste publiée (`liste.txt`)

La liste de la semaine peut aussi être publiée avec l'appli : c'est le fichier `liste.txt` à la racine du dépôt (même format que dans l'espace parent, première ligne facultative `# Titre`). À chaque ouverture, si la tablette est en ligne et que `liste.txt` a changé, l'appli démarre automatiquement une nouvelle semaine avec cette liste. Les mots de la liste publiée précédente descendent dans la mine des souvenirs. Le monde de l'enfant est conservé.

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
- **Nouvelle semaine** : coller la nouvelle liste, puis « Commencer une nouvelle semaine ». Les mots de la semaine descendent dans la mine des souvenirs (case cochée par défaut). Le monde de l'enfant est conservé.
- **La mine des souvenirs** : tableau des mots des semaines passées (intervalle, facilité, réussites d'affilée, prochaine révision, erreurs) et liste des mots sus pour toujours.
- **Réglages** : ouverture automatique du clavier, écriture cursive (police Playwrite FR Moderne), sons, saisie par défaut (clavier ou tuiles), test de la voix.

Si aucune voix française n'est trouvée : **Paramètres Android → Système → Langues → Synthèse vocale** → moteur Google → installer les données vocales **Français (France)**.

## Crédits et licences

Code : MIT. Pixel art, personnage et sons : créés pour cette appli, générés par le code. Polices : SIL Open Font License, voir `fonts/LICENCES.txt`.
