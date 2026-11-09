import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './auth.js';
import { listWords, getWord, createWord, updateWord, deleteWord, importWords, reviewWord } from './handlers/words.js';
import { listDecks, createDeck, updateDeck, deleteDeck, assignDeck } from './handlers/decks.js';

const app = new Hono();

app.use('/api/*', cors());
app.use('/api/*', authMiddleware);

app.get('/api/ping', (c) => c.json({ ok: true }));

// Decks
app.get('/api/decks', listDecks);
app.post('/api/decks', createDeck);
app.put('/api/decks/:id', updateDeck);
app.delete('/api/decks/:id', deleteDeck);
app.post('/api/decks/assign', assignDeck);

// Words
app.get('/api/words', listWords);
app.get('/api/words/:id', getWord);
app.post('/api/words/import', importWords);
app.post('/api/words/:id/review', reviewWord);
app.post('/api/words', createWord);
app.put('/api/words/:id', updateWord);
app.delete('/api/words/:id', deleteWord);

export default app;
