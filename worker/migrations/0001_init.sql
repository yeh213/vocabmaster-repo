CREATE TABLE IF NOT EXISTS words (
  id             TEXT PRIMARY KEY,
  word           TEXT NOT NULL,
  definition     TEXT DEFAULT '',
  part_of_speech TEXT DEFAULT '',
  example        TEXT DEFAULT '',
  senses         TEXT DEFAULT '[]',
  group_id       TEXT,
  created_at     TEXT,
  repetitions    INTEGER DEFAULT 0,
  ease_factor    REAL    DEFAULT 2.5,
  interval       INTEGER DEFAULT 1,
  due_date       TEXT,
  last_reviewed  TEXT,
  total_reviews  INTEGER DEFAULT 0,
  correct_count  INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_words_group_id ON words(group_id);
CREATE INDEX IF NOT EXISTS idx_words_due_date ON words(due_date);

CREATE TABLE IF NOT EXISTS quizzes (
  id          TEXT PRIMARY KEY,
  question    TEXT NOT NULL,
  options     TEXT DEFAULT '[]',
  answer      TEXT DEFAULT '',
  explanation TEXT DEFAULT '',
  category    TEXT,
  created_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_quizzes_category ON quizzes(category);

CREATE TABLE IF NOT EXISTS notes (
  id         TEXT PRIMARY KEY,
  title      TEXT DEFAULT '',
  content    TEXT DEFAULT '',
  created_at TEXT,
  updated_at TEXT
);
