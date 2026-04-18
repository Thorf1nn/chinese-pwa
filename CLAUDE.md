# Instructions pour Claude sur ce projet

## Règle #1 : Pas de commentaires dans le code

**Ne pas ajouter de commentaires.** Le code doit se suffire à lui-même via des noms de variables/fonctions explicites.

Règles strictes :
- ❌ Pas de commentaires décrivant ce que fait le code (`// boucle sur les cartes`, `// calcule la moyenne`)
- ❌ Pas de JSDoc / TSDoc sur les fonctions, sauf si c'est une API publique exposée à un tiers
- ❌ Pas de commentaires-en-tête de fichier qui résument le module
- ❌ Pas de commentaires `// TODO` ou `// FIXME` laissés dans le code livré — ouvrir un vrai ticket ou régler direct
- ❌ Pas de commentaires qui référencent un bug, un ticket, ou une ancienne version (`// fix bug #42`, `// was broken before refactor`)
- ❌ Pas de commentaires qui séparent visuellement des sections (`// === SECTION ===`)

Règles permissives (rares exceptions) :
- ✅ Un commentaire est acceptable seulement si le **pourquoi** est non-évident : contrainte cachée, invariant subtil, contournement d'un bug d'un lib externe
- ✅ Dans ce cas, le commentaire doit expliquer le pourquoi, pas le quoi
- ✅ Exemple acceptable : `// Safari iOS < 15 n'émet pas 'visibilitychange' en PWA standalone`

Si tu ne sais pas si un commentaire est utile, **ne l'écris pas**.

## Règle #2 : Noms explicites

Un bon nom remplace 90% des commentaires. Préférer un nom un peu plus long à un commentaire :
- `fetchCardsFromIndexedDb()` > `fetch()` + `// récupère les cartes depuis IndexedDB`
- `dueCardsSortedByPriority` > `cards` + `// cartes dues triées`

## Règle #3 : Stack du projet

- Vite + Vue 3 (Composition API, `<script setup lang="ts">`) + TypeScript strict
- Tailwind CSS pour le style (pas de CSS custom sauf nécessaire)
- Dexie pour IndexedDB (pas de SQL, pas de backend)
- ts-fsrs pour le SRS
- Pinia pour le state partagé, `ref`/`computed` local sinon

## Règle #4 : Pas de backend

Le projet est 100% client-side, hébergé sur GitHub Pages.
- Pas d'API routes, pas de serveur Node
- Tout passe par IndexedDB
- Les données utilisateur restent sur l'appareil

## Règle #5 : Offline-first

Toute nouvelle feature doit marcher hors-ligne après le premier chargement.
- Si une feature nécessite un appel réseau → prévoir un fallback ou un cache
- Les ressources statiques doivent être dans le précache du service worker
