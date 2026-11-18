import type { H3Event } from 'h3'

const DAY = 86_400_000
export const SESSION_DAYS = 30
export const COOKIE = 'sid'

export async function startSession(event: H3Event, userId: string) {
  const token = randomToken()
  await envOf(event).DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, Date.now() + SESSION_DAYS * DAY).run()
  setCookie(event, COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getRequestURL(event).protocol === 'https:',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

// A signed-in user always works inside one workspace: their first one.
export async function readSession(event: H3Event): Promise<User | null> {
  const bearer = getRequestHeader(event, 'authorization')?.match(/^Bearer (pmk_[a-f0-9]{64})$/)?.[1]
  if (bearer) return readKey(event, bearer)
  const token = getCookie(event, COOKIE)
  if (!token) return null
  const tokenHash = await sha256(token)
  const row = await envOf(event).DB.prepare(
    `SELECT u.id, u.email, m.workspace_id, m.role FROM sessions s JOIN users u ON u.id = s.user_id
     JOIN members m ON m.user_id = u.id WHERE s.token_hash = ? AND s.expires_at > ? ORDER BY m.created_at LIMIT 1`,
  ).bind(tokenHash, Date.now()).first<{ id: string; email: string; workspace_id: string; role: 'owner' | 'member' }>()
  return row ? { id: row.id, email: row.email, tokenHash, workspaceId: row.workspace_id, role: row.role } : null
}

export async function endSession(event: H3Event, tokenHash: string) {
  await envOf(event).DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
  deleteCookie(event, COOKIE, { path: '/' })
}

// First sign-in makes the person a workspace of their own; an invite adds them to someone else's.
export async function ensureWorkspace(event: H3Event, userId: string, email: string) {
  const db = envOf(event).DB
  const has = await db.prepare('SELECT 1 FROM members WHERE user_id = ? LIMIT 1').bind(userId).first()
  if (has) return
  const id = newId()
  const now = Date.now()
  await db.batch([
    db.prepare('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)').bind(id, `${email.split('@')[0]}'s team`, now),
    db.prepare("INSERT INTO members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'owner', ?)").bind(id, userId, now),
  ])
}

// The desktop app signs in with an access key instead of a cookie.
async function readKey(event: H3Event, key: string): Promise<User | null> {
  const db = envOf(event).DB
  const tokenHash = await sha256(key)
  const row = await db.prepare(
    `SELECT k.id AS key_id, u.id, u.email, m.workspace_id, m.role FROM access_keys k JOIN users u ON u.id = k.user_id
     JOIN members m ON m.user_id = u.id WHERE k.key_hash = ? ORDER BY m.created_at LIMIT 1`,
  ).bind(tokenHash).first<{ key_id: string; id: string; email: string; workspace_id: string; role: 'owner' | 'member' }>()
  if (!row) return null
  await db.prepare('UPDATE access_keys SET last_used_at = ? WHERE id = ?').bind(Date.now(), row.key_id).run()
  return { id: row.id, email: row.email, tokenHash, workspaceId: row.workspace_id, role: row.role }
}
