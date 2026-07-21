# Pocketa

Persian RTL personal finance SaaS — track income & expenses, budgets, bank SMS import, reports (Jalali), recurring payments, and savings goals.

| Layer | Stack |
|-------|--------|
| **Frontend** | Next.js 16, React 19, TypeScript, Ant Design (RTL) + Tailwind CSS, TanStack Query, Zustand, Axios, Recharts, Framer Motion |
| **Backend** | Express, TypeScript, MongoDB / Mongoose, JWT + refresh cookies, bcrypt |

## Features

- **Accounts & balances**: multiple bank accounts with a global account filter and balance reconciliation from bank SMS.
- **Transactions**: CRUD, transfers, needs-review flow, search & filters, and **CSV export**.
- **Bank SMS import**: Pasargad/Melli-style SMS import with **preview → confirm → rename**.
- **Categories, Tags & suggestions**: structured categorization + rule-based category suggestions from title.
- **Budgets**: monthly category budgets with progress and alerts (80% / 100%).
- **Reports**: monthly + by-category reports with charts and summaries.
- **Recurring & due items**: recurring payments plus due/settlement flow that can generate transactions.
- **Savings goals**: goals with progress and contribution tracking.
- **Dashboard UX**: due banners and a motivation banner (dismissible per Jalali month).

### Guided onboarding & help
- **Interactive onboarding tour** that auto-starts for new users after registration (desktop/mobile steps).
- Persistent **Help page** at **`/help`** with full guides and a button to restart the tour.

### Mobile UX & quality fixes
- On small screens (`< sm`), the **bottom navbar** hides when the soft keyboard opens for **page-level text inputs** (and doesn’t get stuck after closing modals).
- Scroll/overlay reliability: shared handling for action sheets + Ant Design Modal so body scroll doesn’t break after closing.
- Mobile reliability fixes: prevent iOS focus-zoom on inputs, read-only Jalali date picker inputs, and clamp native time input width to avoid horizontal overflow in modals.
- Dropdown scroll-chain fixes so Select/Picker lists scroll smoothly without fighting the page scroller.

### UI styling
- Dark/Light theme, **Vazirmatn RTL**, Persian formatting (Toman + Jalali).
- Themed scrollbars (light/dark) for desktop.
- Ant Design UI (RTL) + Tailwind with responsive layouts, action sheets, and modals.

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
- Onboarding tour state is persisted locally (zustand `persist`) per user
- RequireAuth gate revalidates session from `/api/auth/me` (cookie-based).

## License

ISC — portfolio project.
