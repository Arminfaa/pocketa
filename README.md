# Pocketa

Persian RTL personal finance SaaS — track income & expenses, budgets, bank SMS import, reports (Jalali), recurring payments, and savings goals.

| Layer | Stack |
|-------|--------|
| **Frontend** | Next.js 16, React 19, TypeScript, Ant Design (RTL) + Tailwind CSS, TanStack Query, Zustand, Axios, Recharts, Framer Motion |
| **Backend** | Express, TypeScript, MongoDB / Mongoose, JWT + refresh cookies, bcrypt |

## Features

- Multi bank accounts with per-account balances and global filter
- Transactions CRUD, filters, CSV export, needs-review flow
- Bank SMS import (Pasargad / Melli) with preview → confirm → rename
- Categories & monthly budgets with 80% / 100% alerts
- Financial reports (monthly + by category)
- Recurring payments (generate transaction on due date)
- Savings goals with progress & contribute
- Tags on transactions + rule-based category suggestions from title
- Sync account balance from latest bank SMS `مانده`
- Dark / light theme, Vazirmatn RTL, Toman + Jalali dates
- Ant Design UI (RTL) with mobile drawer nav and responsive layouts

## Prerequisites

- Node.js 20+
- MongoDB running locally (or a connection URI)

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API defaults to `http://localhost:4000`.

Required env (see `backend/.env.example`):

- `MONGODB_URI`
- `JWT_SECRET` / `REFRESH_TOKEN_SECRET`
- `CORS_ORIGIN` (usually `http://localhost:3000`)

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

App defaults to `http://localhost:3000`.

`NEXT_PUBLIC_API_URL` must point at the backend (e.g. `http://localhost:4000`).

## Scripts

| Package | Command | Purpose |
|---------|---------|---------|
| backend | `npm run dev` | API with hot reload |
| backend | `npm run build` / `npm start` | Compile & run `dist` |
| frontend | `npm run dev` | Next.js dev server |
| frontend | `npm run build` / `npm start` | Production build |
| frontend | `npm run lint` | ESLint |

## Project structure

```
pocketa-app/
├── backend/          # Express API
│   └── src/
│       ├── controllers/
│       ├── models/
│       ├── routes/
│       ├── services/   # e.g. bank SMS parser
│       └── ...
└── frontend/         # Next.js App Router
    └── src/
        ├── app/
        ├── components/
        ├── services/
        └── ...
```

## Auth notes

- Access + refresh tokens in httpOnly cookies (first-party via Vercel `/api` rewrite)
- Production cookies: `Secure` + `SameSite=Lax` (keeps iOS Home Screen PWA sessions)
- Zustand only holds the current user object in memory
- Register seeds default categories + a default bank account

## License

ISC — portfolio project.
