// The team adds screens a link can't reach: a dashboard behind sign-in, a moment mid-action.
const MAX_BYTES = 8 * 1024 * 1024
const MAX_PER_PRODUCT = 40

// Trust the bytes, not the file name or the browser's claimed type.
function sniff(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', ext: 'png' }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' }
  if (String.fromCharCode(...b.subarray(0, 4)) === 'RIFF' && String.fromCharCode(...b.subarray(8, 12)) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  return null
}

export default defineEventHandler(async (event) => {
  const productId = await ownProduct(event, getRouterParam(event, 'id'))
  const env = envOf(event)
  const parts = await readMultipartFormData(event)
  const file = parts?.find(p => p.name === 'file' && p.data?.length)
  if (!file) throw createError({ statusCode: 400, statusMessage: 'Choose an image to upload.' })
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'That image is over 8 MB. Use a smaller one.' })
  const kind = sniff(new Uint8Array(file.data))
  if (!kind) throw createError({ statusCode: 415, statusMessage: 'Use a PNG, JPEG or WebP image.' })
  const field = (n: string) => parts!.find(p => p.name === n)?.data.toString('utf8') ?? ''
  const label = field('label').trim().slice(0, 80) || (file.filename ?? 'screen').replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').slice(0, 80)
  const dim = (n: string) => { const v = Math.round(Number(field(n))); return v > 0 && v < 20000 ? v : 0 }
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM shots WHERE product_id = ?').bind(productId).first<{ n: number }>()
  if ((count?.n ?? 0) >= MAX_PER_PRODUCT) throw createError({ statusCode: 409, statusMessage: `A product can hold ${MAX_PER_PRODUCT} screens. Remove some first.` })

  const id = newId()
  const key = `shots/${productId}/${id}.${kind.ext}`
  await env.MEDIA.put(key, file.data, { httpMetadata: { contentType: kind.mime } })
  await env.DB.prepare("INSERT INTO shots (id, product_id, r2_key, label, page, w, h, use, source, mime, added_by, created_at) VALUES (?, ?, ?, ?, 'uploaded', ?, ?, 1, 'upload', ?, ?, ?)")
    .bind(id, productId, key, label, dim('w'), dim('h'), kind.mime, userOf(event).id, Date.now()).run()
  return { id }
})
