// Makes an access key for the desktop app. The key is shown once; only its hash is kept.
export default defineEventHandler(async (event) => {
  const user = userOf(event)
  const { label } = await body<{ label?: string }>(event)
  const key = `pmk_${randomToken()}`
  await envOf(event).DB.prepare('INSERT INTO access_keys (id, user_id, key_hash, label, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(newId(), user.id, await sha256(key), String(label ?? 'desktop app').slice(0, 60), Date.now()).run()
  return { key }
})
