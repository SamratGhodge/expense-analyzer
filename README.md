# Expense Analyzer

Expense Analyzer is a React + Vite web application for personal expense tracking, budgeting, subscriptions, and insights.

## Features

- Email/password and OTP authentication (Supabase Auth)
- Protected dashboard and finance routes
- Transaction views and statement import flow
- Budgeting and subscription tracking pages
- Insights and report export utilities

## Tech Stack

- React 19
- Vite 8
- React Router
- Supabase (Auth + data backend)
- Recharts

## Environment Variables

Create a `.env` file for local development:

```bash
cp .env.example .env
```

Required values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Never commit real secrets to the repository.

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deployment (GitHub Pages)

This project is configured for GitHub Pages with GitHub Actions.

1. Push this repository to GitHub.
2. In **Settings → Secrets and variables → Actions**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. In **Settings → Pages**, ensure source is **GitHub Actions**.
4. Push to `main` branch to trigger deployment.

Your site will publish at:

`https://<your-github-username>.github.io/expense-analyzer/`

## Notes for Supabase

In Supabase Auth settings, add your GitHub Pages URL to allowed redirect URLs if required by your auth flow.
