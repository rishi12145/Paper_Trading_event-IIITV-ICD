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
  // Add the fee column if it doesn't exist
  db.run(`ALTER TABLE transactions ADD COLUMN fee REAL DEFAULT 0`, (err) => {
    if (err && err.code !== "SQLITE_ERROR") {
      // Ignore if column already exists
      console.error("Error adding fee column:", err);
    }
  });
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

// Session store
const loggedInUsers = {};

//----------------------------------------
//This section contains all the variables which can impace the STOCK VALUE.
//----------------------------------------

// Configuration for price simulation
const TRANSACTION_FEE_RATE = 0.005; // 0.5% transaction fee
const TIME_STEP = 10000; // 5 seconds in milliseconds
// ADJUST HERE: Drift (MU) for 1-hour event
// Example: 5% growth over 1 hour (3600 seconds), scaled to 5-second intervals (3600 / 5 = 720 steps)
// 0.05 / 720 = 0.00006944 per 5-second step
const MU = 0.05 / (3600 / 5); // 5% drift over 1 hour
// ADJUST HERE: Volatility (SIGMA) for 1-hour event
// Example: 20% volatility over 1 hour, scaled to 5-second intervals
// 0.2 / sqrt(720) ≈ 0.007453 per 5-second step
const SIGMA = 0.1 / Math.sqrt(3600 / 5); // 20% volatility over 1 hour
const LAMBDA = 0.005; // Increased sensitivity for a shorter event
// ADJUST HERE: Baseline volume for 1-hour event
// Example: 100 shares as typical volume over 1 hour (much lower than a year-long simulation)
const BASELINE_VOLUME = 100; // Reduced to reflect 1-hour trading activity

// Function to calculate GBM price change
function getGBMPriceChange(currentPrice, dt) {
  const drift = MU * dt;
  const volatility = SIGMA * Math.sqrt(dt) * (Math.random() - 0.5) * 2; // Normal random variable approximation
  return currentPrice * (drift + volatility);
}

// Simulate stock price updates with GBM and market impact
setInterval(() => {
  db.all(`SELECT ticker, currentPrice FROM stocks`, (err, stocks) => {
    if (err) return console.error(err);

    // Aggregate orders from transactions in the last time step
    const timeThreshold = new Date(Date.now() - TIME_STEP).toISOString();
    db.all(
      `SELECT ticker, type, SUM(quantity) as volume 
       FROM transactions 
       WHERE timestamp >= ? 
       GROUP BY ticker, type`,
      [timeThreshold],
      (err, orders) => {
        if (err) return console.error(err);

        const orderImpact = {};
        stocks.forEach(
          (stock) => (orderImpact[stock.ticker] = { buy: 0, sell: 0 })
        );

        // Aggregate buy and sell volumes
        orders.forEach((order) => {
          if (order.type === "buy") {
            orderImpact[order.ticker].buy = order.volume;
          } else if (order.type === "sell") {
            orderImpact[order.ticker].sell = order.volume;
          }
        });

        // Update prices for each stock
        stocks.forEach((stock) => {
          const { buy, sell } = orderImpact[stock.ticker];
          const netDemand = buy - sell;
          const impactFactor = LAMBDA * (netDemand / BASELINE_VOLUME);

          // Calculate GBM component
          const priceChangeFromModel = getGBMPriceChange(
            stock.currentPrice,
            TIME_STEP / 1000
          ); // Convert to seconds
          const newPrice =
            stock.currentPrice *
            (1 + priceChangeFromModel / stock.currentPrice + impactFactor);

          // Ensure price stays above a minimum threshold
          const finalPrice = Math.max(10, newPrice);

          // Update stocks table
          db.run(
            `UPDATE stocks SET currentPrice = ? WHERE ticker = ?`,
            [finalPrice, stock.ticker],
            (err) => {
              if (err) console.error(`Error updating ${stock.ticker}:`, err);
            }
          );

          // Record in stock history
          db.run(
            `INSERT INTO stock_history (ticker, price, time) VALUES (?, ?, ?)`,
            [stock.ticker, finalPrice, new Date().toISOString()],
            (err) => {
              if (err)
                console.error(
                  `Error logging history for ${stock.ticker}:`,
                  err
                );
            }
          );
        });
      }
    );
  });
}, TIME_STEP);

// API Endpoints

// Register
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
        });
      }
    );
  });
});

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
    `SELECT u.email, 
            u.cash + COALESCE(SUM(t.profitLoss), 0) AS totalValue,
            COALESCE(SUM(t.profitLoss), 0) AS profitLoss
     FROM users u
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

          const tradeValue = price * quantity;
          const fee = tradeValue * TRANSACTION_FEE_RATE; // 0.1% of trade value
          const totalCost = tradeValue + fee;

          if (user.cash < totalCost) {
            return res.json({
              success: false,
              message: "Not enough cash (including transaction fee)",
            });
          }

          db.run(`UPDATE users SET cash = cash - ? WHERE email = ?`, [
            totalCost,
            userEmail,
          ]);
          db.run(
            `INSERT INTO portfolios (email, ticker, quantity) VALUES (?, ?, ?) 
     ON CONFLICT(email, ticker) DO UPDATE SET quantity = quantity + ?`,
            [userEmail, ticker, quantity, quantity]
          );
          db.run(
            `INSERT INTO transactions (email, type, ticker, price, quantity, total, fee, timestamp) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              userEmail,
              "buy",
              ticker,
              price,
              quantity,
              tradeValue,
              fee,
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
          if (err || !portfolio || portfolio.quantity < quantity) {
            return res.json({
              success: false,
              message: "Not enough stock to sell",
            });
          }

          const tradeValue = price * quantity;
          const fee = tradeValue * TRANSACTION_FEE_RATE; // 0.1% of trade value
          const netProceeds = tradeValue - fee;

          db.get(
            `SELECT price FROM transactions WHERE email = ? AND ticker = ? AND type = 'buy' ORDER BY timestamp DESC LIMIT 1`,
            [userEmail, ticker],
            (err, buyRow) => {
              const profitLoss = buyRow ? (price - buyRow.price) * quantity : 0;
              db.run(`UPDATE users SET cash = cash + ? WHERE email = ?`, [
                netProceeds,
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
                `INSERT INTO transactions (email, type, ticker, price, quantity, total, profitLoss, fee, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  userEmail,
                  "sell",
                  ticker,
                  price,
                  quantity,
                  tradeValue,
                  profitLoss,
                  fee,
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
