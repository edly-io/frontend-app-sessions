# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Feature Context File

**`FEATURE_CONTEXT.md`** (in this directory) tracks the active feature under development — its goal, design decisions, implementation state, files changed, and open questions.

**Read it at the start of every session** to get up to speed without needing the user to re-explain current work.

**Update it whenever you:**
- Make a design decision (and note why)
- Complete or start an implementation step
- Add or significantly change a file
- Identify a blocker or open question
- Resolve something that was previously unclear

Keep it concise — it is a running snapshot, not a log. Overwrite stale entries rather than appending. When a feature ships, clear the active feature section.

## Backend Requests File

**`BACKEND_REQUESTS.md`** (in this directory) tracks API changes we need from the backend team.

**Update it whenever you:**
- Discover a missing endpoint that blocks frontend work
- Agree on a contract for a future endpoint
- Learn that a backend request has been resolved or cancelled

---

## Commands

```bash
# Development
npm start            # Dev server (uses .env.development)

# Build & Validation
npm run build        # Production webpack build
npm run lint         # stylelint + eslint (.js/.jsx/.ts/.tsx) + tsc
npm run lint:fix     # Auto-fix lint issues
npm run types        # TypeScript type check (no emit)

# Testing
npm test                              # Run all tests with coverage
npx jest src/calendar/CalendarPage    # Run a single test file
npx jest --testPathPattern="calendar" # Run tests matching a pattern

# i18n
npm run i18n_extract  # Extract translation strings
```

Node.js 24 is required (see `.nvmrc`).

---

## Architecture Overview

This is an Open edX **Micro Frontend (MFE)** for session scheduling, attendance tracking, and leave/request management. It mounts at `/sessions/` and communicates with the LMS at `LMS_BASE_URL` (configured in `.env.development`).

### Entry & Routing

`src/index.tsx` bootstraps `@edx/frontend-platform` and wraps the app in `AppProvider` + `QueryClientProvider` (TanStack Query v5). All routes are defined in `src/app/routes.tsx` and exported as a `<Routes>` fragment (`sessionsAdminRoutes`).

All routes are programme-scoped: `/:programId/<section>`. The root `/` is a `SessionsLanding` resolver that fetches the programme list and immediately redirects to `/:firstProgramId/calendar`. Legacy `/calendar` bookmarks redirect to `/`.

Route sections: `calendar`, `requests`, `attendance` (layout route with sub-routes), `locations` (admin-only).

### Shell & Navigation

- `SessionsAdminLayout` — header + footer slots, `ProgramSelector`, `SectionNav`, content area
- `ProgramSelector` — reads `programId` from params; navigates to `/:newProgramId/<section>` on change; renders a static heading when only one programme exists (stub data in `src/app/api.js` — TODO: replace with real endpoint)
- `SectionNav` — top-level pill tabs; `Locations` tab hidden for non-admins
- `AuthGate` — redirects unauthenticated users to LMS login with `next=` param
- `AttendancePage` — layout route rendering `AttendanceSubNav` + `<Outlet />`; role-aware sub-nav (admin: Sessions / Course Summary / Per-Learner; learner: My Attendance only)

### API Layer

All endpoints share a single base URL: `${LMS_BASE_URL}/fbr/api/attendance/v1`

Each feature folder owns its own `api.js`:
- `src/calendar/api.js` — session CRUD, cancel/delete, calendar fetch, course-run/instructor lookups, correction
- `src/attendance/api.js` — attendance records, roster, mark-attendance, per-learner history, summary report
- `src/requests/api.js` — session request create/list/review (learner & admin)
- `src/locations/api.js` — location CRUD
- `src/app/api.js` — programme list (currently stubbed)

All calls use `getAuthenticatedHttpClient()` from `@edx/frontend-platform/auth`.

### Data Fetching Pattern

Data fetching uses plain async/await with `useState`/`useEffect` (not React Query hooks). TanStack Query is set up in `src/index.tsx` but not yet used in any feature — add React Query hooks for new data fetching rather than extending the `useState` pattern.

### Role System

`user_role` is returned by `GET /calendar-sessions/` as a top-level field. Values: `admin`, `instructor`, `learner` (defined in `src/shared/constants.js` as `USER_ROLE`). Role gates are applied per-component via `getAuthenticatedUser()?.administrator` (for admin/non-admin) or the `userRole` state from the calendar API response (for the 3-way split).

### Shared Utilities

`src/shared/constants.js` — `ATTENDANCE_STATUS`, `SESSION_STATUS_LABELS`, `SESSION_PLATFORM`, `REQUEST_TYPE`, `REQUEST_STATUS`, `USER_ROLE` — source of truth for all status/role string values.

`src/shared/utils.js` — `formatDateTime`, `toISOString`, `toDateTimeLocal`, `formatDuration`, `getStatusVariant`, `extractApiError`, `bucketSessionsByDay`.

`src/shared/SearchableSelect.jsx` — reusable async autocomplete built on a plain `<input>` + `<datalist>` (no react-select dependency).

### Backend

The Django backend lives at:
`../tutor-contrib-fbr/tutorfbr/templates/fbr/openedx-features-fbr/fbr/lms/attendance/`

Key sub-directories:
- `models.py` — `Location`, `Session`, `AttendanceRecord`, `SessionRequest`, `SessionMaterial`
- `api/urls.py` — full URL map for all `v1/` endpoints
- `api/views/` — split by domain: `sessions.py`, `attendance.py`, `calendar.py`, `requests.py`, `locations.py`, `materials.py`, `misc.py`
- `services/` — business logic: `session_service.py`, `attendance_service.py`, `zoom_service.py`, `meeting_service.py`, `session_request_service.py`, `calendar_service.py`, `role_utils.py`

### UI Component Library

All UI uses `@openedx/paragon` — `StandardModal`, `DataTable`, `Form`, `Button`, `Spinner`, `Alert`, `Badge`, `Toast`, `NavLink`. No custom modal/table primitives.
