import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import LibraryView from '../components/library/LibraryView.vue'

// Hash history — production loads the renderer via file:// (loadFile), where
// HTML5 history routes would 404 on reload/deep-link.
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'library',
    component: LibraryView
  },
  {
    path: '/program/:id',
    name: 'detail',
    component: () => import('../views/ProgramDetailView.vue'),
    props: true
  },
  {
    path: '/program/:id/edit',
    name: 'edit',
    component: () => import('../views/ProgramEditView.vue'),
    props: true
  }
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})

export default router
