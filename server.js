const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

// Database setup
const db = new sqlite3.Database("holotrade.db", (err) => {
  if (err) console.error("Database connection error:", err);
  else console.log("Connected to SQLite database");
});

// Initialize tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        password TEXT,
        cash REAL DEFAULT 100000,
        verified INTEGER DEFAULT 0,
        isAdmin INTEGER DEFAULT 0,
        verificationCode TEXT
    )`);
  db.run(`CREATE TABLE IF NOT EXISTS portfolios (
        email TEXT,
        ticker TEXT,
        quantity INTEGER,
        PRIMARY KEY (email, ticker)
    )`);
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT,
        type TEXT,
        ticker TEXT,
        price REAL,
        quantity INTEGER,
        total REAL,
        profitLoss REAL,
        timestamp TEXT
    )`);
  db.run(`CREATE TABLE IF NOT EXISTS stocks (
        ticker TEXT PRIMARY KEY,
        currentPrice REAL
    )`);
  db.run(`CREATE TABLE IF NOT EXISTS stock_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticker TEXT,
        price REAL,
        time TEXT
    )`);
});

// Seed initial stocks if empty
db.get(`SELECT COUNT(*) as count FROM stocks`, (err, row) => {
  if (row.count === 0) {
    const initialStocks = [
      { ticker: "TATA", currentPrice: 100 },
      { ticker: "RELI", currentPrice: 150 },
      { ticker: "INFY", currentPrice: 200 },
    ];
    initialStocks.forEach((stock) => {
      db.run(`INSERT INTO stocks (ticker, currentPrice) VALUES (?, ?)`, [
        stock.ticker,
        stock.currentPrice,
      ]);
      db.run(
        `INSERT INTO stock_history (ticker, price, time) VALUES (?, ?, ?)`,
        [stock.ticker, stock.currentPrice, new Date().toISOString()]
      );
    });
  }
});

// Seed initial admins if empty
db.get(`SELECT COUNT(*) as count FROM users WHERE isAdmin = 1`, (err, row) => {
  if (row.count === 0) {
    const admins = [
      { email: "admin1@xai.com", password: "pass123" },
      { email: "admin2@xai.com", password: "pass456" },
      { email: "admin3@xai.com", password: "pass789" },
      { email: "admin4@xai.com", password: "pass101" },
      { email: "admin5@xai.com", password: "pass202" },
      { email: "admin6@xai.com", password: "pass303" },
      { email: "admin7@xai.com", password: "pass404" },
      { email: "admin8@xai.com", password: "pass505" },
      { email: "admin9@xai.com", password: "pass606" },
      { email: "admin10@xai.com", password: "pass707" },
    ];
    admins.forEach(async ({ email, password }) => {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run(
        `INSERT INTO users (email, password, verified, isAdmin) VALUES (?, ?, 1, 1)`,
        [email, hashedPassword]
      );
    });
  }
});

// OPTIONAL: If you're resetting the database
db.run(`CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    password TEXT,
    cash REAL DEFAULT 100000,
    verified INTEGER DEFAULT 1,
    isAdmin INTEGER DEFAULT 0
)`);

// Session store
const loggedInUsers = {};

// Nodemailer setup

// API Endpoints

// Register
// Register (without OTP verification)
app.post("/api/register", async (req, res) => {
  const { email, password, isAdmin } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  db.get(`SELECT email FROM users WHERE email = ?`, [email], (err, row) => {
    if (row)
      return res.json({ success: false, message: "Email already registered" });

    db.run(
      `INSERT INTO users (email, password, verified, isAdmin) VALUES (?, ?, 1, ?)`,
      [email, hashedPassword, isAdmin ? 1 : 0],
      (err) => {
        if (err)
          return res
            .status(500)
            .json({ success: false, message: "Database error" });

        res.json({
          success: true,
          message: "Registered successfully",
          redirect: "/",
        }); // home page redirect
      }
    );
  });
});

// Verify
// app.post("/api/verify", (req, res) => {
//   const { email, code } = req.body;
//   db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
//     if (err || !row || row.verified || row.verificationCode !== code) {
//       return res.json({ success: false, message: "Invalid email or code" });
//     }
//     db.run(
//       `UPDATE users SET verified = 1, verificationCode = NULL WHERE email = ?`,
//       [email]
//     );
//     res.json({
//       success: true,
//       message: "Email verified",
//       isAdmin: row.isAdmin === 1,
//     });
//   });
// });

// Login
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, row) => {
    if (err || !row)
      return res.json({ success: false, message: "Email not registered" });
    if (!row.verified)
      return res.json({ success: false, message: "Email not verified" });
    if (!(await bcrypt.compare(password, row.password)))
      return res.json({ success: false, message: "Incorrect password" });

    const sessionId = `${email}-${Date.now()}`; // Simple session ID
    loggedInUsers[sessionId] = email;
    res.json({ success: true, sessionId, isAdmin: row.isAdmin === 1 });
  });
});

// Get stocks
app.get("/api/stocks", (req, res) => {
  db.all(`SELECT ticker, currentPrice FROM stocks`, (err, rows) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(rows);
  });
});

// Get stock history
app.get("/api/stock-history/:ticker", (req, res) => {
  const { ticker } = req.params;
  db.all(
    `SELECT price, time FROM stock_history WHERE ticker = ? ORDER BY time ASC LIMIT 100`,
    [ticker],
    (err, rows) => {
      if (err || !rows.length)
        return res.status(404).json({ message: "Stock not found" });
      res.json(rows);
    }
  );
});

// Get user data
app.get("/api/user", (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const email = loggedInUsers[sessionId];
  if (!email)
    return res.status(401).json({ success: false, message: "Not logged in" });

  db.get(
    `SELECT email, cash FROM users WHERE email = ?`,
    [email],
    (err, user) => {
      if (err || !user)
        return res.status(404).json({ error: "User not found" });
      db.all(
        `SELECT ticker, quantity FROM portfolios WHERE email = ?`,
        [email],
        (err, portfolioRows) => {
          const portfolio = portfolioRows.reduce((acc, row) => {
            acc[row.ticker] = row.quantity;
            return acc;
          }, {});
          db.all(
            `SELECT * FROM transactions WHERE email = ? ORDER BY timestamp DESC`,
            [email],
            (err, transactions) => {
              res.json({
                name: user.email,
                cash: user.cash,
                portfolio,
                transactions,
              });
            }
          );
        }
      );
    }
  );
});

// Get non-admin users
app.get("/api/users", (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const email = loggedInUsers[sessionId];
  db.get(`SELECT isAdmin FROM users WHERE email = ?`, [email], (err, row) => {
    if (err || !row || !row.isAdmin)
      return res.status(403).json({ success: false, message: "Admin only" });

    db.all(`SELECT email FROM users WHERE isAdmin = 0`, (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(rows);
    });
  });
});

// Get all portfolios
app.get("/api/all-portfolios", (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const email = loggedInUsers[sessionId];
  if (!email)
    return res.status(401).json({ success: false, message: "Not logged in" });

  db.all(
    `SELECT p.email, p.ticker, p.quantity, s.currentPrice, (p.quantity * s.currentPrice) as totalValue 
            FROM portfolios p JOIN stocks s ON p.ticker = s.ticker`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      db.all(
        `SELECT email FROM users WHERE isAdmin = 0 AND email NOT IN (SELECT DISTINCT email FROM portfolios)`,
        (err, emptyUsers) => {
          const allPortfolios = [
            ...rows,
            ...emptyUsers.map((u) => ({ email: u.email })),
          ];
          res.json(allPortfolios);
        }
      );
    }
  );
});

// Get leaderboard
app.get("/api/leaderboard", (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const email = loggedInUsers[sessionId];
  if (!email)
    return res.status(401).json({ success: false, message: "Not logged in" });

  db.all(
    `SELECT u.email, u.cash + COALESCE(SUM(p.quantity * s.currentPrice), 0) as totalValue,
            COALESCE(SUM(t.profitLoss), 0) as profitLoss
            FROM users u
            LEFT JOIN portfolios p ON u.email = p.email
            LEFT JOIN stocks s ON p.ticker = s.ticker
            LEFT JOIN transactions t ON u.email = t.email AND t.profitLoss IS NOT NULL
            WHERE u.isAdmin = 0
            GROUP BY u.email, u.cash
            ORDER BY totalValue DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: "Database error" });
      res.json(rows);
    }
  );
});

// Buy stock
app.post("/api/buy", (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const adminEmail = loggedInUsers[sessionId];
  if (!adminEmail)
    return res.status(401).json({ success: false, message: "Not logged in" });
  db.get(
    `SELECT isAdmin FROM users WHERE email = ?`,
    [adminEmail],
    (err, row) => {
      if (!row || !row.isAdmin)
        return res.status(403).json({ success: false, message: "Admin only" });

      const { ticker, price, quantity, userEmail } = req.body;
      db.get(
        `SELECT cash FROM users WHERE email = ?`,
        [userEmail],
        (err, user) => {
          if (err || !user)
            return res.json({ success: false, message: "User not found" });
          const total = price * quantity;
          if (user.cash < total)
            return res.json({
              success: false,
              message: "Not enough cash for this user",
            });

          db.run(`UPDATE users SET cash = cash - ? WHERE email = ?`, [
            total,
            userEmail,
          ]);
          db.run(
            `INSERT INTO portfolios (email, ticker, quantity) VALUES (?, ?, ?) ON CONFLICT(email, ticker) DO UPDATE SET quantity = quantity + ?`,
            [userEmail, ticker, quantity, quantity]
          );
          db.run(
            `INSERT INTO transactions (email, type, ticker, price, quantity, total, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              userEmail,
              "buy",
              ticker,
              price,
              quantity,
              total,
              new Date().toISOString(),
            ]
          );
          res.json({ success: true });
        }
      );
    }
  );
});

// Sell stock
app.post("/api/sell", (req, res) => {
  const sessionId = req.headers["x-session-id"];
  const adminEmail = loggedInUsers[sessionId];
  if (!adminEmail)
    return res.status(401).json({ success: false, message: "Not logged in" });
  db.get(
    `SELECT isAdmin FROM users WHERE email = ?`,
    [adminEmail],
    (err, row) => {
      if (!row || !row.isAdmin)
        return res.status(403).json({ success: false, message: "Admin only" });

      const { ticker, price, quantity, userEmail } = req.body;
      db.get(
        `SELECT quantity FROM portfolios WHERE email = ? AND ticker = ?`,
        [userEmail, ticker],
        (err, portfolio) => {
          if (err || !portfolio || portfolio.quantity < quantity)
            return res.json({
              success: false,
              message: "Not enough stock to sell",
            });

          const total = price * quantity;
          db.get(
            `SELECT price FROM transactions WHERE email = ? AND ticker = ? AND type = 'buy' ORDER BY timestamp DESC LIMIT 1`,
            [userEmail, ticker],
            (err, buyRow) => {
              const profitLoss = buyRow ? (price - buyRow.price) * quantity : 0;
              db.run(`UPDATE users SET cash = cash + ? WHERE email = ?`, [
                total,
                userEmail,
              ]);
              db.run(
                `UPDATE portfolios SET quantity = quantity - ? WHERE email = ? AND ticker = ?`,
                [quantity, userEmail, ticker]
              );
              db.run(
                `DELETE FROM portfolios WHERE email = ? AND ticker = ? AND quantity = 0`,
                [userEmail, ticker]
              );
              db.run(
                `INSERT INTO transactions (email, type, ticker, price, quantity, total, profitLoss, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  userEmail,
                  "sell",
                  ticker,
                  price,
                  quantity,
                  total,
                  profitLoss,
                  new Date().toISOString(),
                ]
              );
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

// Simulate stock price updates
setInterval(() => {
  db.all(`SELECT ticker, currentPrice FROM stocks`, (err, stocks) => {
    if (err) return console.error(err);
    stocks.forEach((stock) => {
      const fluctuation = (Math.random() - 0.5) * 10; // Random change ±5
      const newPrice = Math.max(10, stock.currentPrice + fluctuation);
      db.run(`UPDATE stocks SET currentPrice = ? WHERE ticker = ?`, [
        newPrice,
        stock.ticker,
      ]);
      db.run(
        `INSERT INTO stock_history (ticker, price, time) VALUES (?, ?, ?)`,
        [stock.ticker, newPrice, new Date().toISOString()]
      );
    });
  });
}, 5000);

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Server error" });
});

app.listen(port, () =>
  console.log(`Server running at http://localhost:${port}`)
);
