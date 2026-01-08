require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// PostgreSQL Connection
// Note: We create the pool but don't connect immediately to allow server startup even if DB config is missing initially
let pool;

const getDB = () => {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            console.error("DATABASE_URL is missing. API will fail.");
            return null;
        }
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL.includes('sslmode=require') 
                ? { rejectUnauthorized: false } 
                : false
        });
    }
    return pool;
};

// Helper to convert snake_case DB result to camelCase for frontend
const toCamelCase = (row) => {
    const newRow = {};
    for (const key in row) {
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        newRow[camelKey] = row[key];
    }
    return newRow;
};

// Helper to convert camelCase trade object to snake_case for DB insert
const mapTradeToParams = (t) => [
    t.id, t.accountId, t.symbol, t.type, t.status, t.outcome,
    t.entryPrice, t.exitPrice, t.stopLoss, t.takeProfit, t.quantity,
    t.fees, t.mainPnl, t.pnl, t.balance,
    t.createdAt, t.entryDate, t.exitDate, t.entryTime, t.exitTime,
    t.entrySession, t.exitSession, t.orderType, t.setup,
    t.leverage, t.riskPercentage, t.notes, t.emotionalNotes,
    JSON.stringify(t.tags || []),
    JSON.stringify(t.screenshots || []),
    JSON.stringify(t.partials || []),
    t.isDeleted || false, t.deletedAt, t.isBalanceUpdated || false
];

// --- Middleware to check DB connection ---
app.use(async (req, res, next) => {
    const db = getDB();
    if (!db) {
        return res.status(500).json({ error: "Database configuration missing (DATABASE_URL)." });
    }
    req.db = db;
    next();
});

// --- API Routes ---

// GENERIC SETTINGS (Theme, Columns, User Profile, etc.)
app.get('/api/settings/:key', async (req, res) => {
    const { key } = req.params;
    try {
        const result = await req.db.query("SELECT value FROM app_settings WHERE key = $1", [key]);
        res.json(result.rows.length > 0 ? result.rows[0].value : null);
    } catch (err) {
        // If table doesn't exist, return null gracefully (first run)
        if (err.code === '42P01') return res.json(null);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings', async (req, res) => {
    const { key, value } = req.body;
    try {
        await req.db.query(
            "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            [key, JSON.stringify(value)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ACCOUNTS
app.get('/api/accounts', async (req, res) => {
    try {
        const result = await req.db.query('SELECT * FROM accounts ORDER BY name ASC');
        res.json(result.rows.map(row => ({
            id: row.id,
            name: row.name,
            currency: row.currency,
            balance: parseFloat(row.balance),
            isDemo: row.is_demo,
            type: row.type
        })));
    } catch (err) {
        // Handle "relation does not exist" (First run)
        if (err.code === '42P01') return res.json([]);
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/accounts', async (req, res) => {
    const { id, name, currency, balance, isDemo, type } = req.body;
    try {
        await req.db.query(
            `INSERT INTO accounts (id, name, currency, balance, is_demo, type)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, currency = EXCLUDED.currency, 
             balance = EXCLUDED.balance, is_demo = EXCLUDED.is_demo, type = EXCLUDED.type`,
            [id, name, currency, balance, isDemo, type]
        );
        const result = await req.db.query('SELECT * FROM accounts ORDER BY name ASC');
        res.json(result.rows.map(row => ({
            id: row.id,
            name: row.name,
            currency: row.currency,
            balance: parseFloat(row.balance),
            isDemo: row.is_demo,
            type: row.type
        })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/accounts/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await req.db.query('DELETE FROM accounts WHERE id = $1', [id]);
        const result = await req.db.query('SELECT * FROM accounts');
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TRADES
app.get('/api/trades', async (req, res) => {
    try {
        const result = await req.db.query('SELECT * FROM trades ORDER BY entry_date DESC');
        const trades = result.rows.map(row => {
            const t = toCamelCase(row);
            t.entryPrice = parseFloat(t.entryPrice);
            t.exitPrice = t.exitPrice ? parseFloat(t.exitPrice) : undefined;
            t.pnl = parseFloat(t.pnl);
            t.quantity = parseFloat(t.quantity);
            return t;
        });
        res.json(trades);
    } catch (err) {
        if (err.code === '42P01') return res.json([]);
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/trades', async (req, res) => {
    const t = req.body;
    try {
        await req.db.query(
            `INSERT INTO trades (
                id, account_id, symbol, type, status, outcome,
                entry_price, exit_price, stop_loss, take_profit, quantity,
                fees, main_pnl, pnl, balance,
                created_at, entry_date, exit_date, entry_time, exit_time,
                entry_session, exit_session, order_type, setup,
                leverage, risk_percentage, notes, emotional_notes,
                tags, screenshots, partials,
                is_deleted, deleted_at, is_balance_updated
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
                $29, $30, $31, $32, $33, $34
            ) ON CONFLICT (id) DO UPDATE SET
                symbol = EXCLUDED.symbol, type = EXCLUDED.type, status = EXCLUDED.status, outcome = EXCLUDED.outcome,
                entry_price = EXCLUDED.entry_price, exit_price = EXCLUDED.exit_price, 
                stop_loss = EXCLUDED.stop_loss, take_profit = EXCLUDED.take_profit, quantity = EXCLUDED.quantity,
                fees = EXCLUDED.fees, main_pnl = EXCLUDED.main_pnl, pnl = EXCLUDED.pnl, balance = EXCLUDED.balance,
                entry_date = EXCLUDED.entry_date, exit_date = EXCLUDED.exit_date,
                entry_time = EXCLUDED.entry_time, exit_time = EXCLUDED.exit_time,
                entry_session = EXCLUDED.entry_session, exit_session = EXCLUDED.exit_session,
                order_type = EXCLUDED.order_type, setup = EXCLUDED.setup,
                notes = EXCLUDED.notes, emotional_notes = EXCLUDED.emotional_notes,
                tags = EXCLUDED.tags, screenshots = EXCLUDED.screenshots, partials = EXCLUDED.partials,
                is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at, is_balance_updated = EXCLUDED.is_balance_updated
            `,
            mapTradeToParams(t)
        );
        const result = await req.db.query('SELECT * FROM trades ORDER BY entry_date DESC');
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/trades/batch', async (req, res) => {
    const { ids } = req.body;
    try {
        await req.db.query('DELETE FROM trades WHERE id = ANY($1)', [ids]);
        const result = await req.db.query('SELECT * FROM trades ORDER BY entry_date DESC');
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/trades/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await req.db.query('DELETE FROM trades WHERE id = $1', [id]);
        const result = await req.db.query('SELECT * FROM trades ORDER BY entry_date DESC');
        res.json(result.rows.map(toCamelCase));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// TAGS
app.get('/api/tags', async (req, res) => {
    try {
        const result = await req.db.query("SELECT value FROM app_settings WHERE key = 'tag_groups'");
        if (result.rows.length > 0) {
            res.json(result.rows[0].value);
        } else {
            res.json([]);
        }
    } catch (err) {
        if (err.code === '42P01') return res.json([]);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/tags', async (req, res) => {
    const groups = req.body;
    try {
        await req.db.query(
            "INSERT INTO app_settings (key, value) VALUES ('tag_groups', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            [JSON.stringify(groups)]
        );
        res.json(groups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// STRATEGIES
app.get('/api/strategies', async (req, res) => {
    try {
        const result = await req.db.query("SELECT value FROM app_settings WHERE key = 'strategies'");
        if (result.rows.length > 0) {
            res.json(result.rows[0].value);
        } else {
            res.json([]);
        }
    } catch (err) {
        if (err.code === '42P01') return res.json([]);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/strategies', async (req, res) => {
    const strategies = req.body;
    try {
        await req.db.query(
            "INSERT INTO app_settings (key, value) VALUES ('strategies', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
            [JSON.stringify(strategies)]
        );
        res.json(strategies);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// MONTHLY NOTES
app.get('/api/monthly-notes/:key', async (req, res) => {
    const { key } = req.params;
    try {
        const result = await req.db.query('SELECT * FROM monthly_notes WHERE month_key = $1', [key]);
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.json({});
        }
    } catch (err) {
        if (err.code === '42P01') return res.json({});
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/monthly-notes', async (req, res) => {
    const { monthKey, data } = req.body;
    try {
        await req.db.query(
            `INSERT INTO monthly_notes (month_key, goals, notes, review)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (month_key) DO UPDATE SET
             goals = EXCLUDED.goals, notes = EXCLUDED.notes, review = EXCLUDED.review`,
            [monthKey, data.goals, data.notes, data.review]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server locally (Only if not running on Vercel)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Backend Server running on port ${PORT}`);
    });
}

// Export for Vercel
module.exports = app;
