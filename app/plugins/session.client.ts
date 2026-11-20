// A session that ends mid-use (expired, signed out elsewhere) sends the person to sign in instead of failing call by call.
export default defineNuxtPlugin(() => {
  const me = useMe()
  const router = useRouter()
  globalThis.$fetch = $fetch.create({
    onResponseError({ request, response }) {
      if (response.status !== 401 || String(request).includes('/api/me') || String(request).includes('/api/auth/')) return
      me.value = null
      const here = router.currentRoute.value.fullPath
      router.push({ path: '/signin', query: here !== '/' ? { next: here } : undefined })
    },
  }) as typeof $fetch
})
