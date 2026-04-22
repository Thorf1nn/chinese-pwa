import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', name: 'dashboard', component: () => import('./views/DashboardView.vue') },
  { path: '/search', name: 'search', component: () => import('./views/SearchView.vue') },
  { path: '/review', name: 'review', component: () => import('./views/ReviewView.vue') },
  { path: '/deck', name: 'deck', component: () => import('./views/DeckView.vue') },
  { path: '/decks', name: 'decks', component: () => import('./views/DecksView.vue') },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
  { path: '/scan', name: 'scan', component: () => import('./views/ScanView.vue') },
  { path: '/card/:id', name: 'card', component: () => import('./views/CardView.vue'), props: true },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
