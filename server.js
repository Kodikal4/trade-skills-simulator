const { Client } = require('pg');

module.exports = async function (context, req) {
    // 1. Grab incoming query filters (defaults to "Diesel" if undefined)
    const trade_type = req.query.trade_type || "all";

    // 2. Instantiate the PostgreSQL link using your Azure environmental variable string
    const client = new Client({
        connectionString: process.env.AZURE_POSTGRESQL_CONNECTION_STRING,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        
        let queryText = '';
        let queryParams = [];

        // 3. Dynamically switch SQL strategies depending on what sector button was clicked
        if (trade_type === 'all') {
            // Pulls the entire 50-question block seamlessly across all domains
            queryText = `
                SELECT 
                    challengeid AS id, 
                    trade_type, 
                    component, 
                    symptom, 
                    question, 
                    failure_mode, 
                    explanation, 
                    choices 
                FROM "DiagnosticChallengesTable" 
                ORDER BY trade_type ASC, challengeid ASC;
            `;
        } else {
            // Explicitly isolates just the 10 questions assigned to the selected category node
            queryText = `
                SELECT 
                    challengeid AS id, 
                    trade_type, 
                    component, 
                    symptom, 
                    question, 
                    failure_mode, 
                    explanation, 
                    choices 
                FROM "DiagnosticChallengesTable" 
                WHERE trade_type = $1 
                ORDER BY challengeid ASC;
            `;
            queryParams.push(trade_type);
        }
        
        // 4. Run the optimized database tracking query
        const res = await client.query(queryText, queryParams);
        
        // 5. Always close your pool link to prevent connection leaks!
        await client.end();

        // 6. Return the raw payload object array cleanly back to your frontend fetch script
        context.res = {
            status: 200,
            headers: { 
                "Content-Type": "application/json" 
            },
            body: res.rows
        };

    } catch (err) {
        // Safe context logging to prevent crashes if credentials fail or server times out
        context.log("Database connection or tracking statement failure:", err);
        
        // Gracefully kill the connection block if it didn't shut down in the normal path
        try { await client.end(); } catch (e) { /* client already unlinked */ }

        context.res = { 
            status: 500, 
            body: { error: "Internal Database Connection Error" } 
        };
    }
};