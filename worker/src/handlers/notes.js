import { newId, today } from '../db.js';

export async function listNotes(c) {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM notes ORDER BY updated_at DESC'
  ).all();
  return c.json(results);
}

export async function getNote(c) {
  const row = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?')
    .bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
}

export async function createNote(c) {
  const body = await c.req.json();
  const id = newId();
  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    INSERT INTO notes (id, title, content, created_at, updated_at)
    VALUES (?,?,?,?,?)
  `).bind(id, body.title ?? '', body.content ?? '', now, now).run();
  const row = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
  return c.json(row, 201);
}

export async function updateNote(c) {
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    UPDATE notes SET title=?, content=?, updated_at=? WHERE id=?
  `).bind(body.title ?? '', body.content ?? '', now, id).run();
  const row = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
}

export async function deleteNote(c) {
  await c.env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
}

export async function importNote(c) {
  const body = await c.req.json();
  const id = newId();
  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    INSERT INTO notes (id, title, content, created_at, updated_at)
    VALUES (?,?,?,?,?)
  `).bind(id, body.title ?? 'Imported', body.content ?? '', now, now).run();
  const row = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first();
  return c.json(row, 201);
}
