import { newId, today } from '../db.js';

export async function listDecks(c) {
  const { results } = await c.env.DB.prepare(
    'SELECT d.*, COUNT(w.id) as word_count FROM decks d LEFT JOIN words w ON w.deck_id = d.id GROUP BY d.id ORDER BY d.created_at ASC'
  ).all();
  return c.json(results);
}

export async function createDeck(c) {
  const { name } = await c.req.json();
  if (!name) return c.json({ error: 'name required' }, 400);
  const id = newId();
  await c.env.DB.prepare('INSERT INTO decks (id, name, created_at) VALUES (?,?,?)')
    .bind(id, name, today()).run();
  const row = await c.env.DB.prepare('SELECT * FROM decks WHERE id = ?').bind(id).first();
  return c.json(row, 201);
}

export async function updateDeck(c) {
  const id = c.req.param('id');
  const { name } = await c.req.json();
  await c.env.DB.prepare('UPDATE decks SET name=? WHERE id=?').bind(name, id).run();
  const row = await c.env.DB.prepare('SELECT * FROM decks WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
}

export async function deleteDeck(c) {
  const id = c.req.param('id');
  await c.env.DB.prepare('UPDATE words SET deck_id=NULL WHERE deck_id=?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM decks WHERE id=?').bind(id).run();
  return c.json({ ok: true });
}

export async function assignDeck(c) {
  const { deck_id, word_ids } = await c.req.json();
  if (!Array.isArray(word_ids) || word_ids.length === 0) {
    return c.json({ error: 'word_ids array required' }, 400);
  }
  const stmts = word_ids.map(wid =>
    c.env.DB.prepare('UPDATE words SET deck_id=? WHERE id=?').bind(deck_id ?? null, wid)
  );
  await c.env.DB.batch(stmts);
  return c.json({ updated: word_ids.length });
}
