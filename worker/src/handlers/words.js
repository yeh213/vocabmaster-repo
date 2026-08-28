import { groupIdFromWord, newId, today } from '../db.js';

export async function listWords(c) {
  const { group_id, due_before, deck_id } = c.req.query();
  let sql = 'SELECT * FROM words';
  const params = [];
  const conditions = [];
  if (group_id) { conditions.push('group_id = ?'); params.push(group_id); }
  if (due_before) { conditions.push('due_date <= ?'); params.push(due_before); }
  if (deck_id === 'none') { conditions.push('deck_id IS NULL'); }
  else if (deck_id) { conditions.push('deck_id = ?'); params.push(deck_id); }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY word ASC';
  const { results } = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(results.map(deserialize));
}

export async function getWord(c) {
  const row = await c.env.DB.prepare('SELECT * FROM words WHERE id = ?')
    .bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(deserialize(row));
}

export async function createWord(c) {
  const body = await c.req.json();
  const id = newId();
  const group_id = groupIdFromWord(body.word);
  const due = body.due_date ?? today();
  await c.env.DB.prepare(`
    INSERT INTO words
      (id, word, definition, part_of_speech, example, senses, group_id, deck_id, created_at,
       repetitions, ease_factor, interval, due_date, last_reviewed, total_reviews, correct_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    id, body.word, body.definition ?? '', body.part_of_speech ?? '',
    body.example ?? '', JSON.stringify(body.senses ?? []), group_id, body.deck_id ?? null, today(),
    0, 2.5, 1, due, null, 0, 0
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM words WHERE id = ?').bind(id).first();
  return c.json(deserialize(row), 201);
}

export async function updateWord(c) {
  const id = c.req.param('id');
  const body = await c.req.json();
  const group_id = groupIdFromWord(body.word);
  await c.env.DB.prepare(`
    UPDATE words SET
      word=?, definition=?, part_of_speech=?, example=?, senses=?, group_id=?, deck_id=?
    WHERE id=?
  `).bind(
    body.word, body.definition ?? '', body.part_of_speech ?? '',
    body.example ?? '', JSON.stringify(body.senses ?? []), group_id, body.deck_id ?? null, id
  ).run();
  const row = await c.env.DB.prepare('SELECT * FROM words WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(deserialize(row));
}

export async function deleteWord(c) {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM words WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
}

export async function importWords(c) {
  const { words } = await c.req.json();
  if (!Array.isArray(words) || words.length === 0) {
    return c.json({ error: 'words array required' }, 400);
  }
  const sql = `INSERT OR IGNORE INTO words
    (id, word, definition, part_of_speech, example, senses, group_id, created_at,
     repetitions, ease_factor, interval, due_date, last_reviewed, total_reviews, correct_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < words.length; i += BATCH) {
    const chunk = words.slice(i, i + BATCH);
    const stmts = chunk.map(w => {
      const id = w.id ?? newId();
      const group_id = groupIdFromWord(w.word);
      return c.env.DB.prepare(sql).bind(
        id, w.word, w.definition ?? '', w.partOfSpeech ?? w.part_of_speech ?? '',
        w.example ?? '', JSON.stringify(w.senses ?? []), group_id,
        w.createdAt ?? w.created_at ?? today(),
        w.repetitions ?? 0, w.easeFactor ?? w.ease_factor ?? 2.5,
        w.interval ?? 1, w.dueDate ?? w.due_date ?? today(),
        w.lastReviewed ?? w.last_reviewed ?? null,
        w.totalReviews ?? w.total_reviews ?? 0,
        w.correctCount ?? w.correct_count ?? 0
      );
    });
    await c.env.DB.batch(stmts);
    inserted += chunk.length;
  }
  return c.json({ inserted });
}

export async function reviewWord(c) {
  const id = c.req.param('id');
  const { quality } = await c.req.json(); // 0-5
  const row = await c.env.DB.prepare('SELECT * FROM words WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'Not found' }, 404);

  const sm2 = calcSM2({
    repetitions: row.repetitions,
    easeFactor: row.ease_factor,
    interval: row.interval,
  }, quality);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + sm2.interval);

  await c.env.DB.prepare(`
    UPDATE words SET
      repetitions=?, ease_factor=?, interval=?, due_date=?,
      last_reviewed=?, total_reviews=total_reviews+1,
      correct_count=correct_count+?
    WHERE id=?
  `).bind(
    sm2.repetitions, sm2.easeFactor, sm2.interval,
    dueDate.toISOString().slice(0, 10),
    today(), quality >= 3 ? 1 : 0, id
  ).run();

  const updated = await c.env.DB.prepare('SELECT * FROM words WHERE id = ?').bind(id).first();
  return c.json(deserialize(updated));
}

function calcSM2({ repetitions, easeFactor, interval }, quality) {
  if (quality < 3) {
    return { repetitions: 0, easeFactor, interval: 1 };
  }
  const newEF = Math.max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  let newInterval;
  if (repetitions === 0) newInterval = 1;
  else if (repetitions === 1) newInterval = 6;
  else newInterval = Math.round(interval * newEF);
  return { repetitions: repetitions + 1, easeFactor: newEF, interval: newInterval };
}

function deserialize(row) {
  return {
    ...row,
    senses: typeof row.senses === 'string' ? JSON.parse(row.senses) : (row.senses ?? []),
  };
}
