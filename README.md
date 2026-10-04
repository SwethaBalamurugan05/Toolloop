# ToolLoop — React + FastAPI + Supabase

ToolLoop is a mobile-first peer-to-peer equipment-lending marketplace. Every authenticated person can list equipment they own and rent equipment owned by another ToolLoop user. React provides the UI, FastAPI provides the API, and Supabase PostgreSQL stores persistent profile, equipment, request, and loan data.

## Run the application

```bash
npm install
npm run dev
```

In a second terminal, configure `backend/.env` with the Supabase **service_role** key, then run:

```bash
cd backend
python -m uvicorn app.main:app --reload --port 8001
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Use a 390–430 px-wide browser viewport for the intended mobile design.

## Architecture

```text
React/Vite browser -> FastAPI (/api) -> Supabase Auth + PostgreSQL
```

The browser sends a Supabase-issued bearer token to FastAPI. FastAPI validates the token, derives the authenticated user identity from it, and uses a server-only service-role client for validated database operations. Supabase stores profiles, user-owned equipment, rental requests, and loans.

## Required MVP flow

1. **Login / Create Account** (`/login`) — sign in with Supabase Auth or choose **Create Account** to register with full name, email, password, and confirmation.
2. **Home / Browse Equipment** (`/home`) — search/filter the Supabase equipment catalogue and choose **Request now**.
3. **Request Equipment** (`/request/:equipmentId`) — choose valid dates, quantity, and purpose, then submit.
4. **Request Confirmation** (`/confirmation/:requestId`) — review the requested equipment, owner, and rental period, then return home.
5. **Post / Manage Equipment** (`/equipment/new`, `/my-equipment`) — every authenticated user can list and manage only equipment they own.
6. **Requests for My Equipment** (`/my-equipment/requests`) — an equipment owner approves or rejects only requests for their own listings.

## Component reuse evidence

| Required component | Where it is reused |
| --- | --- |
| `CustomButton` | Login, Home equipment cards, Request form, Confirmation actions |
| `CustomInput` | Login email/password, Home search, Request dates/purpose |
| `ScreenHeader` | Home, Request Equipment, Request Confirmation |

## Validation

- Login requires a valid email address and password with at least six characters.
- A request requires a start date, return date, purpose of at least ten characters, and valid quantity.
- Start dates cannot be in the past.
- Return dates must be after start dates and within the selected equipment's borrowing limit.

## Backend and Supabase configuration

The full SQL schema is in `supabase/schema.sql`. For an existing database created from an earlier version of the schema, run `supabase/migrations/20260930_add_signup_profiles.sql` once in Supabase SQL Editor before using signup. The migration adds `profiles.full_name`, changes the normal role to `user`, updates the automatic Auth-to-profile trigger, and retains RLS. The frontend reads only `VITE_API_BASE_URL`; all privileged Supabase database access goes through FastAPI. The browser persists the Supabase-issued access/refresh session in `sessionStorage` for page-refresh recovery; ToolLoop never stores user passwords in browser storage.

For the peer-to-peer marketplace, run these migrations in Supabase SQL Editor, in order:

1. `supabase/migrations/20260930_add_signup_profiles.sql`
2. `supabase/migrations/20261003_add_admin_request_review.sql` — required only as the additive source of the existing review/return fields; its global-admin review RPCs are removed by the next migration.
3. `supabase/migrations/20261003_peer_to_peer_marketplace.sql`

The peer-to-peer migration assigns the legacy catalogue to the existing real profile `swetha@gmail.com`, adds equipment/request ownership relationships, removes the obsolete profile role field and global-admin review functions, creates owner-only atomic approval/rejection RPCs, and keeps RLS enabled.

`backend/.env` must use these backend-only values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-complete-server-only-secret-or-service-role-key
FRONTEND_ORIGIN=http://localhost:5173,https://your-project.vercel.app
```

Never add `SUPABASE_KEY` to a Vite `VITE_*` variable. The React browser stores only the Supabase-issued session token data in `sessionStorage` for a page-refresh recovery and calls FastAPI with a Bearer header. It never stores passwords, a Supabase service-role key, or database credentials. FastAPI creates an isolated Supabase service-role client for each operation so browser-session validation cannot change the authorization context used for server-side writes.

For local frontend development, `.env.local` may set this safe browser value. The file is ignored by Git:

```env
VITE_API_BASE_URL=http://127.0.0.1:8001
```

### Peer-to-peer ownership

There are no seller account types and no global rental administrator. Every authenticated ToolLoop user can both post equipment and request another user’s equipment. FastAPI derives equipment ownership from the authenticated token when a listing is created, derives request ownership from the selected equipment record, and rejects attempts to request a user’s own listing. Only the actual equipment owner can approve or reject a pending request.

The React browser never sends trusted `owner_id`, `renter_id`, request status, rental cost, or role values. FastAPI derives and validates all of those values from the bearer token and database records. The Supabase approval/return functions use row locks so concurrent decisions cannot approve the same request twice or overbook available inventory.

## 21st.dev integration

This MVP uses **Modern Stunning Sign In** from 21st.dev / HextaUI. The adapted, ToolLoop-branded source is located at `src/components/ui/modern-stunning-sign-in.jsx`, with source attribution retained in the file. It is visibly used as the Login screen and submits credentials to FastAPI, which authenticates with Supabase Auth before navigation to Home.

Its upstream registry installation command is:

```bash
Copy the component source into `src/components/ui/modern-stunning-sign-in.jsx`
```

The supplied component requires React hooks and Tailwind CSS only. This project already has both Tailwind CSS and `lucide-react`; its remote assets were replaced with local Lucide icons so no external image dependency is needed. The project remains JavaScript/JSX rather than TypeScript; no TypeScript setup is required for the component to work.

## Demonstration checklist

1. Choose **Create Account** and demonstrate invalid name, email, password, and unmatched-password validation.
2. Create a Supabase Auth account, then try the same email again to demonstrate duplicate-account feedback.
3. Sign in using the new account, then try a wrong password to demonstrate credential rejection.
4. Search for “drill” and filter to **Tools** on Home.
5. Post an equipment item, then sign in as a different user to request it and intentionally submit blank fields to show validation.
6. Set a return date before the start date to demonstrate rental-date validation; correct the dates and purpose.
7. Submit and show the confirmation period.
8. Open **Requests for My Equipment** as the listing owner, approve or reject the request, then open **My Activity** as the renter to show the persisted status/rejection reason.

## Production check

```bash
npm run build
npm run preview
```

## Vercel deployment

This repository includes `vercel.json`, `api/index.py`, and root `requirements.txt` for a single Vercel deployment. Vercel builds the Vite frontend and serves FastAPI through `/api/*` on the same deployment origin.

1. Push the repository to GitHub and import it into Vercel.
2. Set `SUPABASE_URL`, `SUPABASE_KEY`, and `FRONTEND_ORIGIN` in Vercel Project Settings.
3. Set `FRONTEND_ORIGIN` to the exact deployed Vercel URL. It accepts a comma-separated allowlist for approved preview URLs.
4. Do not set `VITE_API_BASE_URL` for the same-origin deployment. Set it only if FastAPI is deployed separately over HTTPS.
5. Run the signup-profile, request-review, and peer-to-peer marketplace migrations before using listing ownership, owner approval, or return workflows.

## Assignment 3 evidence

- **Persistent data:** Supabase Table Editor displays `profiles`, `equipment`, `rental_requests`, and `loans`.
- **API organization:** FastAPI routes are in `backend/app/routers`; React calls them through `src/services/api.js`.
- **Key prompts:** `docs/development-prompts.md` documents the principal development prompts.