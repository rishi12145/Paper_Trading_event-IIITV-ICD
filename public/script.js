let sessionId = null;
let chart = null;
let currentTicker = null;
let isAdmin = false;

function showAdminRegister() {
    document.getElementById("admin-register-container").style.display = "block";
    document.getElementById("admin-login-container").style.display = "none";
    document.getElementById("user-register-container").style.display = "none";
    document.getElementById("user-login-container").style.display = "none";
    document.getElementById("verify-container").style.display = "none";
}

function showAdminLogin() {
    document.getElementById("admin-register-container").style.display = "none";
    document.getElementById("admin-login-container").style.display = "block";
    document.getElementById("user-register-container").style.display = "none";
    document.getElementById("user-login-container").style.display = "block";
    document.getElementById("verify-container").style.display = "none";
}

function showUserRegister() {
    document.getElementById("admin-register-container").style.display = "none";
    document.getElementById("admin-login-container").style.display = "none";
    document.getElementById("user-register-container").style.display = "block";
    document.getElementById("user-login-container").style.display = "none";
    document.getElementById("verify-container").style.display = "none";
}

function showUserLogin() {
    document.getElementById("admin-register-container").style.display = "none";
    document.getElementById("admin-login-container").style.display = "block";
    document.getElementById("user-register-container").style.display = "none";
    document.getElementById("user-login-container").style.display = "block";
    document.getElementById("verify-container").style.display = "none";
}

function returnToHome() {
    localStorage.removeItem('sessionId');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('email');
    sessionId = null;
    isAdmin = false;
    document.getElementById("trading-container").style.display = "none";
    document.getElementById("admin-login-container").style.display = "block";
    document.getElementById("user-login-container").style.display = "block";
    document.getElementById("user-instruction").style.display = "none";
    document.getElementById("quantity-header").style.display = "table-cell";
    document.getElementById("user-header").style.display = "table-cell";
    document.getElementById("action-header").style.display = "table-cell";
    document.body.classList.remove('trading-active');
    if (chart) chart.destroy();
}

document.getElementById("admin-register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("admin-reg-email").value;
    const password = document.getElementById("admin-reg-password").value;
    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, isAdmin: true })
    });
    const result = await response.json();
    if (result.success) {
        document.getElementById("verify-email").value = email;
        document.getElementById("admin-register-container").style.display = "none";
        document.getElementById("verify-container").style.display = "block";
    }
    alert(result.message);
});

document.getElementById("user-register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("user-reg-email").value;
    const password = document.getElementById("user-reg-password").value;
    const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, isAdmin: false })
    });
    const result = await response.json();
    if (result.success) {
        document.getElementById("verify-email").value = email;
        document.getElementById("user-register-container").style.display = "none";
        document.getElementById("verify-container").style.display = "block";
    }
    alert(result.message);
});

document.getElementById("verify-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("verify-email").value;
    const code = document.getElementById("verify-code").value;
    const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
    });
    const result = await response.json();
    if (result.success) {
        if (result.isAdmin) {
            document.getElementById("admin-login-email").value = email;
            showAdminLogin();
        } else {
            document.getElementById("user-login-email").value = email;
            showUserLogin();
        }
    }
    alert(result.message);
});

document.getElementById("admin-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("admin-login-email").value;
    const password = document.getElementById("admin-login-password").value;
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const result = await response.json();
    if (result.success && result.isAdmin) {
        sessionId = result.sessionId;
        isAdmin = true;
        localStorage.setItem('sessionId', sessionId);
        localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('email', email);
        document.getElementById("admin-login-container").style.display = "none";
        document.getElementById("user-login-container").style.display = "none";
        document.getElementById("trading-container").style.display = "block";
        document.getElementById("welcome-message").textContent = `Welcome, Admin (${email})`;
        document.body.classList.add('trading-active');
        loadStocks();
        updatePortfolio();
        loadAllPortfolios();
        loadLeaderboard();
        setInterval(() => {
            loadStocks();
            updatePortfolio();
            loadAllPortfolios();
            loadLeaderboard();
        }, 5000);
    } else {
        alert("Invalid admin credentials or not an admin account");
    }
});

document.getElementById("user-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("user-login-email").value;
    const password = document.getElementById("user-login-password").value;
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const result = await response.json();
    if (result.success && !result.isAdmin) {
        sessionId = result.sessionId;
        isAdmin = false;
        localStorage.setItem('sessionId', sessionId);
        localStorage.setItem('isAdmin', 'false');
        localStorage.setItem('email', email);
        document.getElementById("admin-login-container").style.display = "none";
        document.getElementById("user-login-container").style.display = "none";
        document.getElementById("trading-container").style.display = "block";
        document.getElementById("welcome-message").textContent = `Welcome, ${email}`;
        document.getElementById("user-instruction").style.display = "block";
        document.getElementById("quantity-header").style.display = "none";
        document.getElementById("user-header").style.display = "none";
        document.getElementById("action-header").style.display = "none";
        document.body.classList.add('trading-active');
        loadStocks();
        updatePortfolio();
        loadAllPortfolios();
        loadLeaderboard();
        setInterval(() => {
            loadStocks();
            updatePortfolio();
            loadAllPortfolios();
            loadLeaderboard();
        }, 5000);
    } else {
        alert("Invalid user credentials or this is an admin account");
    }
});

window.addEventListener('load', () => {
    const storedSessionId = localStorage.getItem('sessionId');
    const storedIsAdmin = localStorage.getItem('isAdmin');
    const storedEmail = localStorage.getItem('email');
    if (storedSessionId && storedEmail) {
        sessionId = storedSessionId;
        isAdmin = storedIsAdmin === 'true';
        document.getElementById("admin-login-container").style.display = "none";
        document.getElementById("user-login-container").style.display = "none";
        document.getElementById("trading-container").style.display = "block";
        document.getElementById("welcome-message").textContent = isAdmin ? `Welcome, Admin (${storedEmail})` : `Welcome, ${storedEmail}`;
        if (!isAdmin) {
            document.getElementById("user-instruction").style.display = "block";
            document.getElementById("quantity-header").style.display = "none";
            document.getElementById("user-header").style.display = "none";
            document.getElementById("action-header").style.display = "none";
        }
        document.body.classList.add('trading-active');
        loadStocks();
        updatePortfolio();
        loadAllPortfolios();
        loadLeaderboard();
        setInterval(() => {
            loadStocks();
            updatePortfolio();
            loadAllPortfolios();
            loadLeaderboard();
        }, 5000);
    }
    startCountdown();
});

async function loadStocks() {
    const response = await fetch('/api/stocks');
    const stocks = await response.json();
    const stockList = document.getElementById("stock-list");

    const quantities = {};
    const selectedUsers = {};
    stocks.forEach(stock => {
        const qtyInput = document.getElementById(`qty-${stock.ticker}`);
        const userSelect = document.getElementById(`user-${stock.ticker}`);
        if (qtyInput) quantities[stock.ticker] = qtyInput.value;
        if (userSelect) selectedUsers[stock.ticker] = userSelect.value;
    });

    stockList.innerHTML = "";
    if (isAdmin) {
        const usersResponse = await fetch('/api/users', { headers: { 'x-session-id': sessionId } });
        const users = await usersResponse.json();
        stocks.forEach(stock => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <h3>${stock.ticker}</h3>
                <p class="highlight">₹${stock.currentPrice.toFixed(2)}</p>
                <input type="number" id="qty-${stock.ticker}" min="1" value="${quantities[stock.ticker] || 1}">
                <select id="user-${stock.ticker}">
                    ${users.map(user => `<option value="${user.email}" ${selectedUsers[stock.ticker] === user.email ? 'selected' : ''}>${user.email}</option>`).join('')}
                </select>
                <div class="stock-actions">
                    <button onclick="buyStock('${stock.ticker}', ${stock.currentPrice})"><i class="fas fa-shopping-cart"></i> Buy</button>
                    <button onclick="sellStock('${stock.ticker}', ${stock.currentPrice})"><i class="fas fa-arrow-down"></i> Sell</button>
                    <button onclick="showChart('${stock.ticker}')"><i class="fas fa-chart-line"></i> Chart</button>
                </div>
            `;
            stockList.appendChild(card);
        });
    } else {
        stocks.forEach(stock => {
            const card = document.createElement("div");
            card.className = "card";
            card.innerHTML = `
                <h3>${stock.ticker}</h3>
                <p class="highlight">₹${stock.currentPrice.toFixed(2)}</p>
                <button onclick="showChart('${stock.ticker}')"><i class="fas fa-chart-line"></i> View Chart</button>
            `;
            stockList.appendChild(card);
        });
    }
}

async function updatePortfolio() {
    const response = await fetch('/api/user', { headers: { 'x-session-id': sessionId } });
    const user = await response.json();
    const portfolioList = document.getElementById("portfolio-list");
    const balanceDisplay = document.getElementById("balance");
    const transactionTableBody = document.getElementById("transaction-table-body");
    const totalTransactions = document.getElementById("total-transactions");

    balanceDisplay.textContent = user.cash.toFixed(2);
    portfolioList.innerHTML = "";
    for (let ticker in user.portfolio) {
        const stockData = (await (await fetch('/api/stocks')).json()).find(s => s.ticker === ticker);
        const totalValue = user.portfolio[ticker] * stockData.currentPrice;
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <h3>${ticker}</h3>
            <p>Quantity: ${user.portfolio[ticker]}</p>
            <p>Value: ₹${totalValue.toFixed(2)}</p>
        `;
        portfolioList.appendChild(card);
    }

    transactionTableBody.innerHTML = "";
    user.transactions.forEach(tx => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${tx.type.toUpperCase()}</td>
            <td>${tx.ticker}</td>
            <td>₹${tx.price.toFixed(2)}</td>
            <td>${tx.quantity}</td>
            <td>₹${tx.total.toFixed(2)}</td>
            <td>${tx.profitLoss ? `₹${tx.profitLoss.toFixed(2)}` : '-'}</td>
            <td>${new Date(tx.timestamp).toLocaleString()}</td>
        `;
        transactionTableBody.appendChild(row);
    });
    totalTransactions.textContent = user.transactions.length;
}

async function loadAllPortfolios() {
    const response = await fetch('/api/all-portfolios', { headers: { 'x-session-id': sessionId } });
    const portfolios = await response.json();
    const allPortfoliosList = document.getElementById("all-portfolios-list");
    allPortfoliosList.innerHTML = "";
    portfolios.forEach(entry => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
            <p><strong>${entry.email}</strong></p>
            <p>Ticker: ${entry.ticker || '-'}</p>
            <p>Qty: ${entry.quantity || '-'}</p>
            <p>Value: ${entry.totalValue ? `₹${entry.totalValue.toFixed(2)}` : '-'}</p>
        `;
        allPortfoliosList.appendChild(card);
    });
}

async function loadLeaderboard() {
    const response = await fetch('/api/leaderboard', { headers: { 'x-session-id': sessionId } });
    const leaderboard = await response.json();
    const leaderboardTableBody = document.getElementById("leaderboard-table-body");
    leaderboardTableBody.innerHTML = "";
    leaderboard.forEach((entry, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>#${index + 1}</td>
            <td>${entry.email}</td>
            <td>₹${entry.totalValue.toFixed(2)}</td>
            <td>₹${entry.profitLoss.toFixed(2)}</td>
        `;
        leaderboardTableBody.appendChild(row);
    });
}

async function buyStock(ticker, price) {
    const quantity = parseInt(document.getElementById(`qty-${ticker}`).value);
    const userEmail = document.getElementById(`user-${ticker}`).value;
    const response = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({ ticker, price, quantity, userEmail })
    });
    const result = await response.json();
    if (result.success) {
        updatePortfolio();
        loadAllPortfolios();
        loadLeaderboard();
        loadStocks(); // Refresh stocks to preserve user selection
    }
    alert(result.message || "Buy successful");
}

async function sellStock(ticker, price) {
    const quantity = parseInt(document.getElementById(`qty-${ticker}`).value);
    const userEmail = document.getElementById(`user-${ticker}`).value;
    const response = await fetch('/api/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
        body: JSON.stringify({ ticker, price, quantity, userEmail })
    });
    const result = await response.json();
    if (result.success) {
        updatePortfolio();
        loadAllPortfolios();
        loadLeaderboard();
        loadStocks(); // Refresh stocks to preserve user selection
    }
    alert(result.message || "Sell successful");
}

async function showChart(ticker) {
    currentTicker = ticker;
    updateChart(ticker);
}

async function updateChart(ticker) {
    const response = await fetch(`/api/stock-history/${ticker}`);
    const history = await response.json();
    const ctx = document.getElementById('price-chart').getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(h => new Date(h.time).toLocaleTimeString()),
            datasets: [{
                label: `${ticker} Price (₹)`,
                data: history.map(h => h.price),
                borderColor: '#26A69A',
                backgroundColor: 'rgba(38, 166, 154, 0.2)',
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#7E57C2',
                pointHoverRadius: 8
            }]
        },
        options: {
            animation: { duration: 1000, easing: 'easeInOutQuad' },
            scales: {
                x: { title: { display: true, text: 'Time', color: '#333' } },
                y: { title: { display: true, text: 'Price (₹)', color: '#333' } }
            },
            plugins: {
                tooltip: { backgroundColor: '#7E57C2', titleColor: '#FFF', bodyColor: '#FFF' }
            }
        }
    });
}

function startCountdown() {
    const competitionStart = new Date('March 24, 2025 20:30:00').getTime();
    const adminTimer = document.getElementById("admin-countdown-timer");

    if (!adminTimer) {
        console.error("Admin countdown timer element not found!");
        return;
    }

    function updateTimer() {
        const now = new Date().getTime();
        const timeLeft = competitionStart - now;

        if (timeLeft <= 0) {
            adminTimer.innerHTML = "Competition Started!";
            clearInterval(timerInterval);
            return;
        }

        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        const daysEl = document.getElementById("admin-days");
        const hoursEl = document.getElementById("admin-hours");
        const minutesEl = document.getElementById("admin-minutes");
        const secondsEl = document.getElementById("admin-seconds");

        if (daysEl && hoursEl && minutesEl && secondsEl) {
            daysEl.textContent = String(days).padStart(2, '0');
            hoursEl.textContent = String(hours).padStart(2, '0');
            minutesEl.textContent = String(minutes).padStart(2, '0');
            secondsEl.textContent = String(seconds).padStart(2, '0');
        } else {
            console.error("One or more timer elements are missing!");
            clearInterval(timerInterval);
        }
    }

    updateTimer();
    const timerInterval = setInterval(updateTimer, 1000);
}