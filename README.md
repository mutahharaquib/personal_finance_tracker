# FinTrac — Personal Finance Tracker

A modern, mobile-friendly money tracker built with Node.js, Express 5, MongoDB and EJS.
Track income and expenses, set budgets, save towards goals, automate recurring bills and
see where your money goes — in light or dark mode, on any device.

## Features

- **Dashboard**: balance, this month's income/spending, savings rate, a 6-month cash-flow chart, spending by category, budget and goal snapshots, upcoming bills and plain-language insights (like "you've spent 18% more than at this point last month").
- **Transactions**: add, edit and delete from a quick dialog (press <kbd>N</kbd> anywhere). Search, filter by type, category and date range, sort, and page through results with running totals.
- **Categories**: 21 ready-made categories with icons and colours. Add your own in Settings.
- **Budgets**: monthly limits per category plus an optional overall budget. Progress bars warn at 80%, and the page shows how much you can still spend per day. You can browse past months.
- **Savings goals**: set a target and an optional deadline, then add or withdraw money. The app works out how much you need to save each month.
- **Recurring transactions**: salary, rent and subscriptions (daily, weekly, monthly or yearly) are posted automatically when due. You can pause, resume or give them an end date.
- **Reports**: preset or custom date ranges, comparison with the previous period, a trend chart, category breakdowns, top expenses and average daily spend.
- **CSV import & export**: exports open in Excel or Google Sheets. Imports accept bank-style files (DD/MM/YYYY dates, negative amounts treated as expenses).
- **Account**: register, log in, forgot/reset password by email, change password, currency preference (13 currencies), and deleting your account together with all its data.
- **Security**: bcrypt password hashing, sessions stored in MongoDB, a new session on login, CSRF tokens on every form, Helmet security headers with a strict CSP, rate-limited auth routes, server-side validation, and a per-user check on every query so no one can reach another user's data.

## Getting started

Requirements: Node.js 18.18+ and MongoDB (local or [Atlas](https://www.mongodb.com/atlas)).

```bash
npm install
cp .env.example .env      # then set MONGO_URI and SESSION_SECRET
npm run dev               # http://localhost:3000 (auto-restarts on changes)
```

To look around with realistic data, seed a demo account:

```bash
npm run seed:demo         # log in with demo@fintrac.app / demo1234
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Start the server |
| `npm run dev` | Start with auto-reload |
| `npm run seed:demo` | Create or reset the demo account with 6 months of data |
| `npm test` | Run the test suite |

Tests use an in-memory MongoDB by default. To use a MongoDB server you already run, set
`TEST_MONGO_URI=mongodb://127.0.0.1:27017`. To make the in-memory server reuse an installed
`mongod` instead of downloading one, set `MONGOMS_SYSTEM_BINARY`.

## Project structure

```
server.js            entry point: loads env, connects DB, starts the app
app.js               Express app (security, sessions, routes, error pages)
config/              DB connection and constants (default categories, currencies)
models/              User, Transaction, Category, Budget, Goal, Recurring
controllers/         request handlers, one per feature
routes/              URL → controller wiring
services/            stats aggregations, recurring engine, categories, mailer
middlewares/         auth guard, CSRF, flash messages, error handling
utils/               dates (UTC), formatting, validation, CSV
views/               EJS pages + partials (app shell, auth layout)
public/              CSS, client JS (dialogs, theme, charts), favicon
scripts/seed-demo.js demo data
test/                integration + unit tests (node:test + supertest)
```

## Deploying

Set `NODE_ENV=production`, `MONGO_URI`, `SESSION_SECRET` and (for password reset) the
`SMTP_*` variables. Run the app behind HTTPS: in production, cookies are marked `secure` and
the app trusts the first proxy (Render, Railway, Heroku and similar hosts work as-is).
