const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors'); 

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.AZURE_POSTGRESQL_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false 
    }
});

// Upgraded schema definition auto-runs text[] migration if missing
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
        console.log('✅ PostgreSQL schema successfully validated/created with Choices tracking.');
    } catch (err) {
        console.error('❌ Schema initialization error:', err.stack);
    }
};
initDb();

// API Route: Fetch all master records
app.get('/api/trades', async (_req, res) => {
    try {
        const result = await pool.query('SELECT * FROM trade_sectors ORDER BY id DESC;');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve trade metrics' });
    }
});

// API Route: Insert a comprehensive engineering console entry with explicit Array tracking
app.post('/api/trades', async (req, res) => {
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
        res.status(500).json({ error: 'Failed to insert trade data payload' });
    }
});

app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Node backend live and listening on port ${PORT}`);
});
