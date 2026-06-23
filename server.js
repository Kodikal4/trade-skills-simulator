const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware to parse incoming JSON payloads
app.use(express.json());

// Initialize Database connection pool using Azure environment variable
const pool = new Pool({
    connectionString: process.env.AZURE_POSTGRESQL_CONNECTION_STRING,
    ssl: {
        rejectUnauthorized: false // Required for secure cloud database clusters
    }
});

// Test database connectivity on startup
pool.query('SELECT NOW()', (err, _res) => {
    if (err) {
        console.error('❌ Database connection error:', err.stack);
    } else {
        console.log('✅ Successfully connected to PostgreSQL Database cluster.');
    }
});

// API Route: Fetch all tracking records for your skilled trades
app.get('/api/trades', async (_req, res) => {
    try {
        const result = await pool.query('SELECT * FROM trade_sectors ORDER BY id ASC;');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to retrieve trade metrics' });
    }
});

// API Route: Add a new entry to the tracking system
app.post('/api/trades', async (req, res) => {
    const { sector, allocation } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO trade_sectors (sector, allocation) VALUES ($1, $2) RETURNING *;',
            [sector, allocation]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to insert trade data payload' });
    }
});

// Serve frontend layout (Assumes your HTML file is named index.html)
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Node server cleanly booted and listening on port ${PORT}`);
});