# Skill Gap Intelligence Platform (SGIP)

SGIP is a full-stack career intelligence platform for students, mentors, placement teams, and administrators. It converts profile data and skill evidence into an explainable readiness score, a prioritized roadmap, and institution-level analytics.

## What is included

- JWT authentication and role-based authorization
- Student profiles, skill inventory, evidence library, role selection, gap reports, roadmaps, and printable reports
- Deterministic weighted scoring (Beginner 30%, Intermediate 70%, Advanced 100%)
- Mentor assignment enforcement and actionable feedback summaries
- Placement analytics, placement-ready segmentation, search-ready APIs, and CSV export
- Admin user controls, career role catalog, and audit logs
- Safe AI service with allow-listed resume extraction and deterministic fallbacks
- PostgreSQL persistence through Prisma, validation, rate limiting, secure headers, logging, API docs, Docker support, and seed data
- Responsive React/Tailwind dashboards with charts and role-aware navigation

## Architecture

```text
frontend/  React 19 + TypeScript + Vite + Tailwind + TanStack Query
backend/   Express 5 + TypeScript + Prisma/PostgreSQL + JWT
```

The API uses `/api/v1`. Interactive API documentation is available at `/docs` when the backend is running.

## Run locally

Requirements: Node.js 20+, npm 10+, and a running PostgreSQL database. You can use the included Docker Compose PostgreSQL service or a Supabase project.

1. Install the backend and frontend dependencies from the repository root:

   ```bash
   npm install
   ```

2. Copy the backend settings from `.env.example` into `backend/.env`. Set `DATABASE_URL` and replace `JWT_ACCESS_SECRET` with a strong secret.

   For Supabase, use the connection string from **Project Settings > Database > Connection string**. Use the pooled URI for the running app and include SSL:

   ```dotenv
   DATABASE_URL=postgresql://postgres.<project-ref>:<database-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?schema=public&sslmode=require
   ```

3. If the API is not running at `http://localhost:5000`, create `frontend/.env.local` and set:

   ```dotenv
   VITE_API_URL=http://localhost:5000/api/v1
   ```

4. Create the database tables:

   ```bash
   npm run db:push -w backend
   ```

5. Seed career roles and demo users:

   ```bash
   npm run seed
   ```

6. Start both development servers from the repository root:

   ```bash
   npm run dev
   ```

To run the applications separately, use two terminals:

```bash
npm run dev -w backend
npm run dev -w frontend
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`
- API docs: `http://localhost:5000/docs`

## Demo accounts

All seeded users use `Password123!`.

| Role | Email |
|---|---|
| Student | `student@sgip.local` |
| Mentor | `mentor@sgip.local` |
| Placement officer | `placement@sgip.local` |
| Administrator | `admin@sgip.local` |

Change these credentials before using the application outside local development.

## Commands

```bash
npm run dev       # frontend and backend development servers
npm run build     # production builds
npm test          # backend unit tests
npm run db:push -w backend  # sync the Prisma schema to the configured database
npm run seed      # idempotent role and demo account seed
```

## Scoring

Every career role contains weighted requirements. For each required skill:

- Missing: 0%
- Beginner: 30%
- Intermediate: 70%
- Advanced: 100%

`readiness = Σ(weight × proficiency factor) / Σ(weight) × 100`

The saved report includes matched, weak, missing, and strong skills, a per-skill breakdown, and evidence coverage. AI never modifies the score.

## AI configuration

`GEMINI_API_KEY` is optional. Without it, roadmap explanations and feedback summaries use deterministic local fallbacks. Resume extraction only returns terms from the curated role skill vocabulary and always marks results for student review.

For production resume PDF parsing, connect a dedicated document extraction service before calling the allow-list validation step. The included endpoint accepts PDF/TXT files, enforces MIME type and 5 MB limits, and demonstrates the safe validation flow.

## Tests

The backend unit suite covers weighted scoring, missing skills, case-insensitive matching, allow-listed resume extraction, and feedback fallback behavior.

```bash
npm test
```

For a production program, add integration tests with an isolated PostgreSQL test container for auth, ownership rules, CRUD, upload validation, and role authorization.

## Deployment

### Frontend (Vercel/Netlify)

- Root directory: `frontend`
- Build command: `npm run build`
- Output: `dist`
- Set `VITE_API_URL=https://your-api.example.com/api/v1`

### Backend (Render/Railway)

- Root directory: `backend`
- Build command: `npm install && npm run build`
- Start command: `npm start`
- Set all backend variables from `.env.example`
- Use Supabase or another managed PostgreSQL provider for `DATABASE_URL`
- Set `CORS_ORIGIN` to the deployed frontend origin

### Docker

Set `JWT_ACCESS_SECRET`, then:

```bash
docker compose up --build
```

The compose file starts PostgreSQL and the API. Run the frontend separately or deploy its static build through a CDN.

## Security notes

- Passwords use bcrypt with 12 rounds.
- JWTs are verified on protected routes.
- Backend ownership and role checks are authoritative.
- Mentor access is restricted to assigned students.
- Helmet, CORS allow-listing, request size limits, rate limiting, file MIME/size checks, and central error handling are enabled.
- Secrets are server-side environment variables and must never use the `VITE_` prefix.

## Main API routes

Auth, student profile, skills, skill evidence, career roles, gap analysis, roadmaps, mentor review, placement analytics/export, admin users, and audit logs follow the endpoint list in the original product specification under `/api/v1`.
