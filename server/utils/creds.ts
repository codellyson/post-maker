// Demo logins are encrypted at rest with AES-GCM under the CRED_KEY secret and never sent back to the browser.
async function key(env: Env) {
  if (!env.CRED_KEY) throw createError({ statusCode: 503, statusMessage: 'Demo logins are not set up yet (CRED_KEY is missing).' })
  const raw = Uint8Array.from(atob(env.CRED_KEY), c => c.charCodeAt(0))
  if (raw.length !== 32) throw new Error('CRED_KEY must be 32 bytes, base64.')
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)))
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0))

export async function sealCreds(env: Env, creds: { user: string; pass: string }) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), new TextEncoder().encode(JSON.stringify(creds)))
  return `${b64(iv)}.${b64(data)}`
}

export async function openCreds(env: Env, sealed: string | null): Promise<{ user: string; pass: string } | null> {
  if (!sealed) return null
  const [iv, data] = sealed.split('.')
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv!) }, await key(env), unb64(data!))
  return JSON.parse(new TextDecoder().decode(plain))
}
