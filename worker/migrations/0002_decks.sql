CREATE TABLE IF NOT EXISTS decks (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TEXT
);

ALTER TABLE words ADD COLUMN deck_id TEXT REFERENCES decks(id);

CREATE INDEX IF NOT EXISTS idx_words_deck_id ON words(deck_id);
