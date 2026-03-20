# 🚀 InfraTrade — Paper Trading Platform

A full-stack paper trading website that lets beginners practice trading with real-time market prices using virtual money.

---

## ✨ Features

- **Real-time prices** — Bitcoin, Ethereum, Solana via CoinGecko API (free, no key needed)
- **10 tradeable assets** — BTC, ETH, SOL (live) + Gold, Silver, AAPL, TSLA, MSFT, AMZN, NVDA (realistic simulation)
- **Full trading engine** — Buy & sell with qty presets (25%, 50%, Max)
- **Portfolio tracker** — Live P&L, position tracking, avg cost
- **Trade history** — Full log of every executed trade
- **Leaderboard** — Compare with other users (backend mode)
- **Adjustable balance** — $1,000 to $1,000,000 starting wallet
- **Works offline** — Frontend-only mode with localStorage if no backend
- **Live price charts** — Streaming price history per asset
- **Mobile-friendly** — Responsive design

---

## 🛠 Setup

### Option A: Frontend Only (No Backend)
Just open `frontend/public/index.html` in your browser.
- Prices are simulated with realistic drift
- Data saved in localStorage (survives page refresh)
- No server needed!

### Option B: Full Stack (Recommended)

**Requirements:** Node.js 16+

**Step 1: Install backend dependencies**
```bash
cd backend
npm install
```

**Step 2: Start the backend**
```bash
npm start
# Server runs on http://localhost:3001
```

**Step 3: Open the frontend**
```bash
# Option 1: Open directly
open frontend/public/index.html

# Option 2: Serve via backend (already configured)
# Visit http://localhost:3001 in your browser
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices` | All current prices |
| GET | `/api/prices/:symbol/history` | Price history for chart |
| POST | `/api/users` | Register / login user |
| GET | `/api/users/:id` | User profile + portfolio |
| POST | `/api/trade` | Execute buy/sell order |
| GET | `/api/users/:id/trades` | Trade history |
| POST | `/api/users/:id/reset` | Reset account |
| GET | `/api/leaderboard` | Top traders |

---

## 📈 Assets Tracked

| Symbol | Name | Price Source |
|--------|------|-------------|
| BTC | Bitcoin | 🟢 Live (CoinGecko) |
| ETH | Ethereum | 🟢 Live (CoinGecko) |
| SOL | Solana | 🟢 Live (CoinGecko) |
| GOLD | Gold | 🟡 Simulated (realistic) |
| SILVER | Silver | 🟡 Simulated (realistic) |
| AAPL | Apple Inc. | 🟡 Simulated (realistic) |
| TSLA | Tesla | 🟡 Simulated (realistic) |
| MSFT | Microsoft | 🟡 Simulated (realistic) |
| AMZN | Amazon | 🟡 Simulated (realistic) |
| NVDA | NVIDIA | 🟡 Simulated (realistic) |

> **For live stock prices**, integrate [Alpha Vantage](https://www.alphavantage.co/) (free tier: 25 req/day) or [Yahoo Finance](https://finance.yahoo.com/) API. Update `fetchCryptoPrices()` in `server.js`.

---

## 🗂 Project Structure

```
infratrade/
├── backend/
│   ├── server.js          # Express API server
│   └── package.json
└── frontend/
    └── public/
        └── index.html     # Complete frontend (HTML/CSS/JS)
```

---

## 🔧 Customization

**Change default balance:** Edit `startingBalance` in `server.js` (SEED_PRICES section)

**Add more assets:** Add to `ASSETS` in `server.js` and `ASSET_META` in `index.html`

**Add real stock prices:** Replace `simulatePrice()` with calls to a stock API

**Add persistent database:** Replace the `store` object in `server.js` with PostgreSQL/MongoDB

---

## 🚀 Deploy to Production

```bash
# Backend on Railway/Render/Fly.io:
# Set PORT env variable, run: node server.js

# Frontend: Any static host (Netlify, Vercel, GitHub Pages)
# Update API URL in index.html: const API = 'https://your-backend.com/api'
```

---

Made with ❤️ — InfraTrade Paper Trading Platform
