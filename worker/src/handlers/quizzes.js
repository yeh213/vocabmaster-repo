import { newId, today } from '../db.js';

export async function listQuizzes(c) {
  const { category } = c.req.query();
  let sql = 'SELECT * FROM quizzes';
  const params = [];
  if (category) { sql += ' WHERE category = ?'; params.push(category); }
  sql += ' ORDER BY created_at DESC';
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(results.map(deserialize));
}

export async function createQuiz(c) {
  const body = await c.req.json();
  const id = newId();
  await c.env.DB.prepare(`
    INSERT INTO quizzes (id, question, options, answer, explanation, category, created_at)
    VALUES (?,?,?,?,?,?,?)
  `).bind(
    id, body.question, JSON.stringify(body.options ?? []),
    body.answer ?? '', body.explanation ?? '',
    body.category ?? null, today()
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(id).first();
  return c.json(deserialize(row), 201);
}

export async function updateQuiz(c) {
  const id = c.req.param('id');
  const body = await c.req.json();
  await c.env.DB.prepare(`
    UPDATE quizzes SET question=?, options=?, answer=?, explanation=?, category=? WHERE id=?
  `).bind(
    body.question, JSON.stringify(body.options ?? []),
    body.answer ?? '', body.explanation ?? '',
    body.category ?? null, id
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM quizzes WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(deserialize(row));
}

export async function deleteQuiz(c) {
  await c.env.DB.prepare('DELETE FROM quizzes WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
}

function deserialize(row) {
  return {
    ...row,
    options: typeof row.options === 'string' ? JSON.parse(row.options) : (row.options ?? []),
  };
}
