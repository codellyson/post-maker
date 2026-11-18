import type { H3Event } from 'h3'

const INVITE_DAYS = 7

export async function createInvite(event: H3Event, email: string) {
  const u = userOf(event)
  const token = randomToken()
  await envOf(event).DB.prepare('INSERT INTO invites (token_hash, workspace_id, email, invited_by, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), u.workspaceId, email, u.id, Date.now() + INVITE_DAYS * 86_400_000).run()
  return token
}

// An invite only works for the address it was sent to, once, before it expires.
export async function acceptInvite(event: H3Event, token: string, userId: string, email: string) {
  const db = envOf(event).DB
  const hash = await sha256(token)
  const inv = await db.prepare('SELECT workspace_id, email, expires_at FROM invites WHERE token_hash = ?').bind(hash).first<{ workspace_id: string; email: string; expires_at: number }>()
  if (!inv || inv.expires_at < Date.now() || inv.email !== email) return false
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO members (workspace_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)").bind(inv.workspace_id, userId, Date.now()),
    db.prepare('DELETE FROM invites WHERE token_hash = ?').bind(hash),
  ])
  return true
}
