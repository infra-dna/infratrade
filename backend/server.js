const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('../frontend/public'));

// ─── In-Memory Store ─────────────────────────────────────────────────────────
// In production, replace with a real database (PostgreSQL, MongoDB, etc.)
const store = {
  users: {},        // { userId: { id, name, email, balance, createdAt } }
  portfolios: {},   // { userId: { symbol: { qty, avgCost } } }
  trades: {},       // { userId: [ ...tradeObjects ] }
  priceCache: {},   // { symbol: { price, change, changePct, updatedAt } }
};

// ─── Asset Configuration ──────────────────────────────────────────────────────
const ASSETS = {
  BTC:  { name: 'Bitcoin',       type: 'crypto',    coingeckoId: 'bitcoin',        symbol: '₿' },
  ETH:  { name: 'Ethereum',      type: 'crypto',    coingeckoId: 'ethereum',       symbol: 'Ξ' },
  SOL:  { name: 'Solana',        type: 'crypto',    coingeckoId: 'solana',         symbol: '◎' },
  GOLD: { name: 'Gold',          type: 'commodity', coingeckoId: null,             symbol: 'Au' },
  SILVER:{ name: 'Silver',       type: 'commodity', coingeckoId: null,             symbol: 'Ag' },
  AAPL: { name: 'Apple Inc.',    type: 'stock',     coingeckoId: null,             symbol: '' },
  TSLA: { name: 'Tesla Inc.',    type: 'stock',     coingeckoId: null,             symbol: '' },
  MSFT: { name: 'Microsoft',     type: 'stock',     coingeckoId: null,             symbol: '' },
  AMZN: { name: 'Amazon',        type: 'stock',     coingeckoId: null,             symbol: '' },
  NVDA: { name: 'NVIDIA',        type: 'stock',     coingeckoId: null,             symbol: '' },
};

// ─── Price Fetching ────────────────────────────────────────────────────────────
// Uses CoinGecko (free, no key needed) for crypto
// Uses a simple simulation for stocks/commodities based on real seed prices
// For production: integrate Alpha Vantage, Yahoo Finance API, or similar

const SEED_PRICES = {
  GOLD:   { base: 2340, vol: 0.003 },
  SILVER: { base: 28.5, vol: 0.006 },
  AAPL:   { base: 194,  vol: 0.008 },
  TSLA:   { base: 178,  vol: 0.018 },
  MSFT:   { base: 415,  vol: 0.006 },
  AMZN:   { base: 188,  vol: 0.009 },
  NVDA:   { base: 875,  vol: 0.020 },
};

// Price history for charts (last 50 ticks)
const priceHistory = {};
Object.keys(ASSETS).forEach(s => { priceHistory[s] = []; });

function simulatePrice(symbol) {
  const seed = SEED_PRICES[symbol];
  if (!seed) return null;
  const prev = store.priceCache[symbol]?.price || seed.base;
  const change = prev * seed.vol * (Math.random() * 2 - 1);
  return Math.max(prev + change, prev * 0.5);
}

async function fetchCryptoPrices() {
  try {
    const cryptos = Object.entries(ASSETS).filter(([, v]) => v.coingeckoId);
    const ids = cryptos.map(([, v]) => v.coingeckoId).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, { timeout: 8000 });
    const data = await res.json();
    cryptos.forEach(([symbol, asset]) => {
      const d = data[asset.coingeckoId];
      if (d) {
        const prev = store.priceCache[symbol]?.price;
        const price = d.usd;
        const change24h = d.usd_24h_change || 0;
        store.priceCache[symbol] = {
          price, change24h,
          changePct: change24h,
          updatedAt: Date.now(),
          source: 'live',
        };
        pushHistory(symbol, price);
      }
    });
  } catch (e) {
    console.log('[prices] CoinGecko fetch failed, using simulation');
    // Fallback: simulate crypto too
    ['BTC','ETH','SOL'].forEach(s => {
      const fallback = { BTC: 67500, ETH: 3550, SOL: 155 };
      const prev = store.priceCache[s]?.price || fallback[s];
      const price = prev * (1 + (Math.random() * 0.01 - 0.005));
      store.priceCache[s] = { price, change24h: 0, changePct: 0, updatedAt: Date.now(), source: 'simulated' };
      pushHistory(s, price);
    });
  }
}

function updateSimulatedPrices() {
  ['GOLD','SILVER','AAPL','TSLA','MSFT','AMZN','NVDA'].forEach(s => {
    const price = simulatePrice(s);
    const prev = store.priceCache[s]?.price || price;
    const changePct = prev ? ((price - prev) / prev) * 100 : 0;
    store.priceCache[s] = { price, change24h: changePct, changePct, updatedAt: Date.now(), source: 'simulated' };
    pushHistory(s, price);
  });
}

function pushHistory(symbol, price) {
  if (!priceHistory[symbol]) priceHistory[symbol] = [];
  priceHistory[symbol].push({ t: Date.now(), p: price });
  if (priceHistory[symbol].length > 100) priceHistory[symbol].shift();
}

// Initial price load + recurring updates
(async () => {
  updateSimulatedPrices();
  await fetchCryptoPrices();
  setInterval(updateSimulatedPrices, 8000);
  setInterval(fetchCryptoPrices, 30000);
})();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getUser(userId) { return store.users[userId]; }
function getPortfolio(userId) { return store.portfolios[userId] || {}; }
function getTrades(userId) { return store.trades[userId] || []; }
function getPrice(symbol) { return store.priceCache[symbol]?.price || 0; }

function portfolioValue(userId) {
  const portfolio = getPortfolio(userId);
  return Object.entries(portfolio).reduce((sum, [sym, pos]) => {
    return sum + pos.qty * getPrice(sym);
  }, 0);
}

function formatAllPrices() {
  return Object.entries(ASSETS).map(([symbol, asset]) => {
    const cache = store.priceCache[symbol] || {};
    return {
      symbol,
      name: asset.name,
      type: asset.type,
      icon: asset.symbol,
      price: cache.price || 0,
      change24h: cache.change24h || 0,
      changePct: cache.changePct || 0,
      source: cache.source || 'pending',
    };
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), assetsTracked: Object.keys(ASSETS).length });
});

// Get all current prices
app.get('/api/prices', (req, res) => {
  res.json({ prices: formatAllPrices(), updatedAt: Date.now() });
});

// Get price history for a symbol
app.get('/api/prices/:symbol/history', (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  if (!ASSETS[symbol]) return res.status(404).json({ error: 'Unknown symbol' });
  res.json({ symbol, history: priceHistory[symbol] || [] });
});

// Register / create user
app.post('/api/users', (req, res) => {
  const { name, email, startingBalance } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

  // Check if email exists
  const existing = Object.values(store.users).find(u => u.email === email);
  if (existing) return res.json({ user: existing });

  const balance = Math.min(Math.max(Number(startingBalance) || 10000, 100), 1000000);
  const id = uuidv4();
  const user = { id, name, email, balance, startingBalance: balance, createdAt: Date.now() };
  store.users[id] = user;
  store.portfolios[id] = {};
  store.trades[id] = [];
  res.json({ user });
});

// Get user profile + portfolio summary
app.get('/api/users/:userId', (req, res) => {
  const user = getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const portfolio = getPortfolio(req.params.userId);
  const pValue = portfolioValue(req.params.userId);
  const totalValue = user.balance + pValue;
  const pnl = totalValue - user.startingBalance;
  const pnlPct = (pnl / user.startingBalance) * 100;

  res.json({
    user: { ...user },
    portfolioValue: pValue,
    totalValue,
    pnl,
    pnlPct,
    positions: Object.entries(portfolio).map(([sym, pos]) => ({
      symbol: sym,
      name: ASSETS[sym]?.name || sym,
      qty: pos.qty,
      avgCost: pos.avgCost,
      currentPrice: getPrice(sym),
      value: pos.qty * getPrice(sym),
      pnl: pos.qty * (getPrice(sym) - pos.avgCost),
      pnlPct: ((getPrice(sym) - pos.avgCost) / pos.avgCost) * 100,
    })).filter(p => p.qty > 0),
  });
});

// Execute a trade (buy or sell)
app.post('/api/trade', (req, res) => {
  const { userId, symbol, action, qty } = req.body;
  const sym = symbol?.toUpperCase();

  if (!userId || !sym || !action || !qty) return res.status(400).json({ error: 'Missing required fields' });
  if (!ASSETS[sym]) return res.status(400).json({ error: 'Unknown asset symbol' });
  if (!['buy', 'sell'].includes(action)) return res.status(400).json({ error: 'Action must be buy or sell' });

  const user = getUser(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const price = getPrice(sym);
  if (!price) return res.status(503).json({ error: 'Price not available yet' });

  const quantity = Number(qty);
  if (isNaN(quantity) || quantity <= 0) return res.status(400).json({ error: 'Quantity must be positive' });

  const totalCost = price * quantity;
  const portfolio = store.portfolios[userId];

  if (action === 'buy') {
    if (user.balance < totalCost) return res.status(400).json({ error: `Insufficient balance. Need $${totalCost.toFixed(2)}, have $${user.balance.toFixed(2)}` });
    user.balance -= totalCost;
    if (!portfolio[sym]) portfolio[sym] = { qty: 0, avgCost: 0 };
    const prev = portfolio[sym];
    const newQty = prev.qty + quantity;
    prev.avgCost = (prev.qty * prev.avgCost + quantity * price) / newQty;
    prev.qty = newQty;
  } else {
    const pos = portfolio[sym];
    if (!pos || pos.qty < quantity) return res.status(400).json({ error: `Insufficient holdings. Have ${pos?.qty || 0}, trying to sell ${quantity}` });
    pos.qty -= quantity;
    user.balance += totalCost;
    if (pos.qty <= 0.0000001) delete portfolio[sym];
  }

  const trade = {
    id: uuidv4(),
    userId,
    symbol: sym,
    action,
    qty: quantity,
    price,
    total: totalCost,
    timestamp: Date.now(),
  };
  store.trades[userId].push(trade);

  res.json({
    success: true,
    trade,
    newBalance: user.balance,
    message: `${action === 'buy' ? 'Bought' : 'Sold'} ${quantity} ${sym} at $${price.toFixed(2)}`,
  });
});

// Get trade history
app.get('/api/users/:userId/trades', (req, res) => {
  const user = getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const trades = getTrades(req.params.userId).slice().reverse();
  res.json({ trades });
});

// Reset user account
app.post('/api/users/:userId/reset', (req, res) => {
  const user = getUser(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { newBalance } = req.body;
  user.balance = Math.min(Math.max(Number(newBalance) || user.startingBalance, 100), 1000000);
  user.startingBalance = user.balance;
  store.portfolios[req.params.userId] = {};
  store.trades[req.params.userId] = [];
  res.json({ success: true, user });
});

// Leaderboard (top users by total portfolio value)
app.get('/api/leaderboard', (req, res) => {
  const board = Object.values(store.users).map(u => {
    const pv = portfolioValue(u.id);
    const total = u.balance + pv;
    return { name: u.name, totalValue: total, pnl: total - u.startingBalance, pnlPct: ((total - u.startingBalance) / u.startingBalance) * 100 };
  }).sort((a, b) => b.totalValue - a.totalValue).slice(0, 20);
  res.json({ leaderboard: board });
});

app.listen(PORT, () => {
  console.log(`\n🚀 InfraTrade Backend running on http://localhost:${PORT}`);
  console.log(`   Assets tracked: ${Object.keys(ASSETS).join(', ')}`);
  console.log(`   Crypto prices: Live via CoinGecko (free API)`);
  console.log(`   Stock/Commodity prices: Simulated (realistic drift model)\n`);

  // Keep-alive ping for Render.com free tier (prevents spin-down after 15min idle)
  // Replace the URL below with your actual Render URL after deploying
  const RENDER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
  setInterval(() => {
    fetch(`${RENDER_URL}/api/health`)
      .then(() => console.log('[keep-alive] ping ok'))
      .catch(() => {});
  }, 600000); // every 10 minutes
});
