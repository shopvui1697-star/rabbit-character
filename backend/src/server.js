import express from 'express';
import cors from 'cors';
import { searchMovies, getMovieById } from './movies.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// ─── Dummy user database ────────────────────────────────────────────
const USERS = [
  { username: 'Honda', password: '1234' },
];

// ─── POST /api/login ────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Validate request body
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.',
    });
  }

  // Check credentials (case-insensitive username)
  const user = USERS.find(
    (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  );

  if (user) {
    return res.json({
      success: true,
      message: `Welcome back, ${user.username}!`,
      user: {
        username: user.username,
      },
    });
  }

  return res.status(401).json({
    success: false,
    message: 'Invalid username or password.',
  });
});

// ─── Movies API ─────────────────────────────────────────────────────

// GET /api/movies?q=matrix&genre=Sci-Fi&sort=rating
app.get('/api/movies', (req, res) => {
  const { q, genre, sort } = req.query;
  const results = searchMovies(q, genre, sort);
  res.json({ success: true, count: results.length, movies: results });
});

// GET /api/movies/:id
app.get('/api/movies/:id', (req, res) => {
  const movie = getMovieById(Number(req.params.id));
  if (!movie) return res.status(404).json({ success: false, message: 'Movie not found.' });
  res.json({ success: true, movie });
});

// ─── Health check ───────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Start server ───────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Backend API running at http://0.0.0.0:${PORT}`);
  console.log(`  Valid credentials: Honda / 1234\n`);
});
