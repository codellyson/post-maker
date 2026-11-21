// Signed-out visitors go to /signin; render pages are opened by the server's headless browser and have their own key.
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path.startsWith('/render')) return
  const me = useMe().value ?? await loadMe()
  // Signed-out visitors may see the front page; everything else needs a session.
  if (!me && to.path !== '/signin' && to.path !== '/') return navigateTo({ path: '/signin', query: to.fullPath !== '/' ? { next: to.fullPath } : undefined })
  if (me && to.path === '/signin' && !to.query.invite) return navigateTo('/')
})
