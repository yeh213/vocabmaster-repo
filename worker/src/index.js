import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './auth.js';
import { listWords, getWord, createWord, updateWord, deleteWord, importWords, reviewWord } from './handlers/words.js';
import { listQuizzes, createQuiz, updateQuiz, deleteQuiz } from './handlers/quizzes.js';
import { listNotes, getNote, createNote, updateNote, deleteNote, importNote } from './handlers/notes.js';
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

// Quizzes
app.get('/api/quizzes', listQuizzes);
app.post('/api/quizzes', createQuiz);
app.put('/api/quizzes/:id', updateQuiz);
app.delete('/api/quizzes/:id', deleteQuiz);

// Notes
app.get('/api/notes', listNotes);
app.get('/api/notes/:id', getNote);
app.post('/api/notes/import', importNote);
app.post('/api/notes', createNote);
app.put('/api/notes/:id', updateNote);
app.delete('/api/notes/:id', deleteNote);

export default app;
