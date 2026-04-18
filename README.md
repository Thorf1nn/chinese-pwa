# Chinese Learner — PWA

PWA perso pour apprendre le chinois : dictionnaire CFDICT (français), flashcards avec SRS basé sur FSRS, support offline, installable sur iPhone.

## Stack

- Vite + Vue 3 (Composition API) + TypeScript
- Tailwind CSS
- Dexie (IndexedDB)
- ts-fsrs (algorithme SRS)
- vite-plugin-pwa (service worker + manifest)
- vue-router (hash history) + Pinia

## Features V1

- 🔍 Recherche dictionnaire CFDICT (~56k entrées) : hanzi, pinyin (sans tons ok), français
- 📚 Deck personnel stocké en local (IndexedDB)
- 🎯 Révision FSRS (4 notes : À revoir / Difficile / Bon / Facile) avec prévisualisation des intervalles
- ✍️ Phrases d'exemple personnelles par carte (paroles, podcasts…)
- 📱 Installable en PWA, fonctionne offline après 1er chargement

## Dev local

```bash
npm install
npm run build:cedict  # télécharge CFDICT et génère public/cedict.json (une seule fois)
npm run dev           # http://localhost:5173
```

## Build

```bash
npm run build     # build prod dans dist/
npm run preview   # sert dist/ localement pour tester la PWA
```

## Déploiement GitHub Pages

Le workflow `.github/workflows/deploy.yml` build et déploie automatiquement sur GitHub Pages à chaque push sur `main`.

**Setup (une seule fois) :**

1. Pousser le repo sur GitHub (par ex. `luca/chinese-pwa`)
2. Dans **Settings → Pages**, sélectionner **Source: GitHub Actions**
3. Si le repo ne s'appelle pas `chinese-pwa`, adapter `base` dans `vite.config.ts` :
   ```ts
   const BASE = process.env.VITE_BASE ?? '/ton-repo/';
   ```
4. Push sur `main` → le workflow déploie tout seul

L'app sera accessible sur `https://<user>.github.io/chinese-pwa/`.

## Installer sur iPhone

1. Ouvrir l'URL dans Safari
2. Partager → **Ajouter à l'écran d'accueil**
3. ⚠️ Critique : sans cette étape, iOS efface l'IndexedDB après 7 jours d'inactivité

## Structure

```
src/
├── lib/
│   ├── db.ts        # Dexie schema (dict, cards, reviews, meta)
│   ├── fsrs.ts      # Wrapper ts-fsrs
│   └── search.ts    # Logique recherche (hanzi/pinyin/français)
├── stores/
│   ├── dict.ts      # Chargement CFDICT → IndexedDB
│   └── deck.ts      # État cartes + reviews
├── components/
│   ├── DictLoader.vue     # Splash + progress import
│   ├── DictEntryCard.vue  # Résultat de recherche
│   ├── Flashcard.vue      # Carte en révision
│   └── ReviewButtons.vue  # 4 boutons FSRS
├── views/
│   ├── SearchView.vue
│   ├── ReviewView.vue
│   ├── DeckView.vue
│   └── CardView.vue       # Détail + ajout phrases
├── router.ts
├── App.vue                # Shell + nav bottom
└── main.ts
```

## Schéma IndexedDB

- `dict` : entrées CFDICT, indexées sur `simplified` + `pinyinPlain`
- `cards` : deck perso, indexées sur `simplified`, `due`, `state`
- `reviews` : log FSRS pour stats futures
- `meta` : version du dictionnaire importé

## Roadmap (post-V1)

- [ ] TTS (Edge TTS → MP3 cache)
- [ ] Import de texte + segmentation (jieba-wasm)
- [ ] Mode cloze / texte à trou (style SuperChinese)
- [ ] Fallback CC-CEDICT si mot manquant dans CFDICT
- [ ] Support caractères traditionnels
- [ ] Stats de révision (heatmap, courbes de rétention)
- [ ] Import/export du deck (JSON)

## Licence & crédits

- **CFDICT** : dictionnaire chinois-français communautaire — https://chine.in/mandarin/dictionnaire/CFDICT/
- **ts-fsrs** : https://github.com/open-spaced-repetition/ts-fsrs
