const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');

// 1. Initialize the app instance first so it can be used below
const app = express();
const PORT = process.env.PORT || 8000;

// 2. Configure CORS middleware now that 'app' is initialized
const allowedOrigins = [
  'https://kodikal4.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// 3. Set up Google Auth and parsing
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(express.json());

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.WEBSITE_HOSTNAME;

// 4. Database Setup
const pool = new Pool({
    connectionString: process.env.AZURE_POSTGRESQL_CONNECTION_STRING,
    user: isProduction ? undefined : 'postgres',
    password: isProduction ? undefined : 'YOUR_LOCAL_POSTGRES_PASSWORD',
    ssl: isProduction ? { rejectUnauthorized: false } : false
});

// Database schema auto-initialization
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS trade_sectors (
                id SERIAL PRIMARY KEY,
                sector TEXT NOT NULL,
                component TEXT NOT NULL,
                symptom TEXT NOT NULL,
                question TEXT NOT NULL,
                failure_mode TEXT NOT NULL,
                explanation TEXT NOT NULL,
                choices TEXT[]
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id SERIAL PRIMARY KEY,
                sector_taken TEXT NOT NULL,
                score_achieved TEXT NOT NULL,
                accuracy_percent INTEGER NOT NULL,
                time_started TEXT NOT NULL,
                time_finished TEXT NOT NULL,
                total_duration_seconds INTEGER NOT NULL,
                user_email TEXT NOT NULL, 
                date_recorded TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ PostgreSQL schemas validated.');
    } catch (err) {
        console.error('❌ Schema initialization error:', err.stack);
    }
};
initDb();

// 🔒 MIDDLEWARE: Bot Barrier Token Verification
async function verifyHumanToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access Blocked: Missing verification token signature.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        
        req.user = {
            email: payload.email,
            name: payload.name
        };
        
        next(); 
    } catch (err) {
        console.error('❌ Security Token Validation Rejected:', err.message);
        return res.status(403).json({ error: 'Access Denied: Invalid signature token.' });
    }
}

// ==========================================
// API ROUTE CHANNELS
// ==========================================

// Fetch questions
app.get('/api/trades', async (_req, res) => {
    try {
        const result = await pool.query('SELECT * FROM trade_sectors ORDER BY id DESC;');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve trade metrics' });
    }
});

// Insert metrics dashboard rows
app.post('/api/quiz-history', verifyHumanToken, async (req, res) => {
    const { sector_taken, score_achieved, accuracy_percent, time_started, time_finished, total_duration_seconds } = req.body;
    const authenticatedUserEmail = req.user.email; 

    try {
        const result = await pool.query(
            `INSERT INTO quiz_attempts (sector_taken, score_achieved, accuracy_percent, time_started, time_finished, total_duration_seconds, user_email) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`,
            [sector_taken, score_achieved, accuracy_percent, time_started, time_finished, total_duration_seconds, authenticatedUserEmail]
        );
        res.status(201).json({ success: true, log: result.rows[0] });
    } catch (err) {
        console.error('❌ Failed to commit performance history:', err);
        res.status(500).json({ error: 'Failed to record analytics payload' });
    }
});

// Admin Route
app.post('/api/trades', verifyHumanToken, async (req, res) => {
    const { sector, component, symptom, question, failure_mode, explanation, choices } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO trade_sectors (sector, component, symptom, question, failure_mode, explanation, choices) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;`,
            [sector, component, symptom, question, failure_mode, explanation, choices]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to insert trade entry' });
    }
});

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Secure Node backend listening on http://localhost:${PORT}`);
});
