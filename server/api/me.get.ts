export default defineEventHandler(async (event) => {
  const u = userOf(event)
  const db = envOf(event).DB
  const [ws, members] = await Promise.all([
    db.prepare('SELECT id, name FROM workspaces WHERE id = ?').bind(u.workspaceId).first<{ id: string; name: string }>(),
    db.prepare('SELECT u.email, m.role FROM members m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ? ORDER BY m.created_at').bind(u.workspaceId).all<{ email: string; role: string }>(),
  ])
  return { email: u.email, role: u.role, workspace: ws, members: members.results }
})
