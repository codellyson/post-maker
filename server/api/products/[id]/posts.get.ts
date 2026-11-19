// Every post for the product from the last 90 days, newest day first.
export default defineEventHandler(async (event) => {
  const id = await ownProduct(event, getRouterParam(event, 'id'))
  return postsFor(event, id, null)
})
