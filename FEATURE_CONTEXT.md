# Feature Context

Tracks the active feature being developed — goals, current state, decisions, and pending work.
Keep this concise. One feature at a time. Update as implementation progresses.

---

## MFE Overview

This MFE (`frontend-app-sessions`) covers four areas:
- **Calendar** — schedule, view, cancel/delete sessions (admin); view enrolled sessions (learner)
- **Requests** — learner submits remote-Zoom or leave requests; admin/instructor reviews them
- **Attendance** — admin marks attendance per session; learners view their own history; reports (per-learner, course summary)
- **Locations** — admin CRUD for physical venue catalogue

All routes are programme-scoped: `/:programId/<section>`. Root `/` auto-redirects to the first programme's calendar.

---

## Active Feature: Substitute Requests + Leave Fan-out Integration

**Status:** Shipped. All 12 test suites, 144 tests passing. Lint clean.

### What was implemented:

1. **Substitute Requests tab** (`src/requests/SubstituteRequestsView.jsx` — new)
   - Admin-only list view with DataTable, status filter (Open/Assigned/Closed), date-from/to filter
   - Row actions: "Assign Substitute" opens modal; "Cancel Session" shows inline confirmation
   - Inline cancel flow: `cancelSession(req.session.id)` + `closeSubstituteRequest(req.id)`
   - Admin guard: `config?.user_role !== USER_ROLE.ADMIN` → null

2. **AssignSubstituteModal** (`src/requests/AssignSubstituteModal.jsx` — new)
   - Edits session title, course, instructors; no separate substitute email field
   - Red warning box showing current instructor(s) on leave (from `session.instructor_emails`)
   - Save blocked if instructor unchanged (`instructorChanged` useMemo + `isValid` guard)
   - On save: `updateSession` + `assignSubstitute(id, selectedInstructors[0].value)`

3. **Substitute requests API** (`src/requests/api.js`)
   - `getSubstituteRequests({ program_key, status, date_from, date_to, page, page_size })`
   - `assignSubstitute(id, substitute_instructor_email)`
   - `closeSubstituteRequest(id)`

4. **RequestsSubNav** — "Substitute Requests" tab conditionally shown for admins only

5. **Routes** (`src/app/routes.tsx`) — added `substitute-requests` route

6. **Instructor on-leave calendar banner** (`src/calendar/CalendarView.jsx`)
   - Banner condition changed from `isLearner &&` to `(isLearner || isInstructor) &&`
   - `CalendarPage.jsx` now fetches `getApprovedLeaves` for instructors too

7. **Threshold message hidden for instructors** (`src/requests/CreateRequestModal.jsx`)
   - `getLeaveUsage` skipped when `isInstructor`
   - Graded activity warning alert when leave range covers graded deadlines

8. **ScheduleMeetingModal on-leave conflict** (`src/calendar/ScheduleMeetingModal.jsx`)
   - Fetches `getApprovedLeaves` on modal open
   - `instructorLeaveError` useMemo: blocks save + shows inline error if selected instructor on leave on session date

9. **ProgramSelector URL fix** (`src/app/SessionsAdminLayout.jsx`)
   - `sectionFromPath`: `parts[2]` → `parts[1]` (was returning sub-section 'leaves' instead of section 'requests')

---

## Previously Shipped: Backend PR Integration — Threshold Enforcement + Approved-Leaves Pagination

**Status:** Shipped. All 11 test suites, 131 tests passing.

### What was integrated:

1. **`src/requests/api.js`**
   - `createRequest` now accepts `override` param → appends `?override=true` to URL
   - `getLeaveUsage` now accepts `q` (name/email search) and `at_risk` (boolean) params
   - Added `getSessionApprovedLeaves({ program_key, q, page, page_size, date_from, date_to })` → `GET /sessions/approved-leaves/`

2. **`src/requests/AdminRequestsView.jsx`**
   - Removed client-side threshold calc (`leaveUsage` state, `usageByEmail`, `effectiveThreshold`, `wouldExceedThreshold`)
   - Now reads `req.would_exceed_threshold === true` directly from API response
   - `LeaveUsagePanel` no longer receives `externalData` — fetches independently

3. **`src/requests/CreateRequestModal.jsx`**
   - Added `thresholdExceeded` state to hold 422 response body
   - `handleSubmit` catches 422 with `error: threshold_exceeded` separately
   - Shows "Leave threshold would be exceeded" warning with detail + counts
   - Footer swaps to "Go back" / "Submit anyway" when threshold exceeded
   - `handleOverrideSubmit` re-POSTs with `override: true`

4. **`src/requests/SessionLeavesPanel.jsx`** (full rewrite)
   - Uses `getSessionApprovedLeaves` — server-side manual pagination (page_size 15)
   - Search bar above table (`?q=` search by session title)
   - Modal shows `students_on_leave` with username/email/date range
   - Removed `getSessions` + `getApprovedLeaves` two-fetch cross-ref approach

5. **`src/requests/LeaveUsagePanel.jsx`**
   - Removed `externalData` prop — always fetches independently
   - Added search bar (name/email) and "At risk only" dropdown filter
   - Passes `q` and `at_risk` to API

### Tests updated:
- `SessionLeavesPanel.test.jsx` — rewritten for new API shape
- `AdminRequestsView.test.jsx` — added `would_exceed_threshold` tests
- `CreateRequestModal.test.jsx` — added 422 threshold confirmation flow tests
- `LeaveUsagePanel.test.jsx` — updated for new search/filter params
- `api.test.js` — added `createRequest` override, `getSessionApprovedLeaves`, `getLeaveUsage` q/at_risk tests

---

## Recently Shipped: Requests Tab Upgrade + Calendar Session Type Colors

**Shipped:** 2026-05-31

### Requests Tab Upgrade
- Replaced old `SessionRequestModal` / `MyRequestsView` / `StudentRequestsTab` with new components based on the new `/v1/requests/` + `/v1/requests/me/` backend API
- **`src/requests/CreateRequestModal.jsx`** — full rewrite: user-driven date range inputs + "Find Sessions" button; filters for future scheduled sessions only; "Select All" checkbox for sessions; leave Full Day mode (selects dates, sends `leave_days: [{ date, type: 'full_day' }]`); leave Session-Specific mode (submit disabled, "coming soon" alert; full UI built)
- **`src/requests/LearnerRequestsView.jsx`** — new: paginated/filterable table of own requests; "New Request" button opens CreateRequestModal
- **`src/requests/AdminRequestsView.jsx`** — new: paginated review queue; Approve (one-click) + Reject (reviewer note modal); `readOnly` prop for instructor variant
- **`src/requests/InstructorRequestsView.jsx`** — thin wrapper: `<AdminRequestsView readOnly />`
- **`src/requests/RequestsPage.jsx`** — routes to appropriate view by `userRole` (admin/instructor/learner)
- **Deleted:** `SessionRequestModal.jsx`, `MyRequestsView.jsx`, `StudentRequestsTab.jsx`

### Calendar Session Type Colors + Status Indicators
- **`src/calendar/CalendarPage.jsx`** — `TYPE_COLOR_PALETTE` (8 colors); `sessionTypeColors` useMemo maps `session_type` value → palette color by config index; extended learner leave hydration to cross-reference leave_days with fetched sessions for strikethrough support; passes `sessionTypeColors` to CalendarView
- **`src/calendar/CalendarView.jsx`** — `getChipBg()` helper (type color takes precedence over status color); `statusDotColors` map; month-view DayCell chips: type-color background + status dot + strikethrough for cancelled/leave; TimeGrid blocks: same pattern with slightly larger dot; `sessionTypeColors` threaded through DayCell → MonthGrid → TimeGrid → WeekGrid → DayView → CalendarView with PropTypes/defaultProps

### Backend Requests File
- **`BACKEND_REQUESTS.md`** — added 4 items: DELETE endpoint for learner PENDING requests; submitter info in serializer; date-window filter on `/me/`; session-level leave payload (`leave_session_ids`)

**Open Questions / Blockers:**
- Backend items #1–#4 in BACKEND_REQUESTS.md are open; frontend stubs/disables gracefully until resolved

---

## Recently Shipped: Search/Pagination + Program Dates + Config Permissions

- `src/locations/api.js` — `getLocations({ search, page, pageSize })` returns `{ count, results }`
- `src/holidays/api.js` — `getHolidays({ search, page, pageSize })` returns `{ count, results }`
- `src/locations/LocationsPage.jsx` — search bar + server-side pagination; uses `useConfig()` for isAdmin
- `src/holidays/HolidaysPage.jsx` — same pattern; uses `useConfig()` for isAdmin
- `src/calendar/api.js` — added `getProgramDates(programKey)`
- `src/calendar/CalendarPage.jsx` — `useConfig()` for userRole; `programDates` state + fetch
- `src/calendar/CalendarView.jsx` — `GradedDatePopover`, amber chips in DayCell + TimeGrid; `isInstructor` prop threaded through all components
- `src/calendar/ScheduleMeetingModal.jsx` — `descriptionOnly` prop; instructor description-only edit
- `src/app/useConfig.js` — React Query hook (`queryKey: ['config']`, 5-min staleTime)

---

## Implemented Features (shipped)

### Programme-Scoped Routing
- All routes migrated to `/:programId/<section>` pattern
- `SessionsLanding` auto-redirects to first programme
- `ProgramSelector` navigates between programmes while preserving section
- `deleteSession` calls `DELETE /sessions/{id}/`; `cancelSession` calls `POST /sessions/{id}/cancel/`

### Calendar
- Month/week/day views; re-fetches on navigation (window ≤ 45 days enforced by backend)
- Admin: create (ScheduleMeetingModal), edit, cancel, delete sessions
- Learner: view sessions, submit session requests (SessionRequestModal)
- Session detail modal for all roles

### Attendance
- Admin sessions list with 30-day sliding window navigation
- Per-session roster with bulk mark-attendance
- Per-Learner History report (paginated, course-filtered)
- Course Summary report (per-learner aggregation)
- Learner: My Attendance view

### Session Requests
- New backend model: `Request` with `type_slug` (`remote_session`/`leave_request`) and `state` (PENDING/APPROVED/REJECTED)
- Learner: date-range + "Find Sessions" flow for remote session requests; Full Day or Session-Specific (disabled, pending backend) leave requests
- Admin: paginated review queue with Approve (one-click) + Reject (reviewer note)
- Instructor: read-only view of the same queue
- Backend gaps tracked in `BACKEND_REQUESTS.md`

### Locations / Holidays
- Admin CRUD with server-side search + pagination

### Shared Infrastructure
- `src/shared/constants.js` — all status/role enums
- `src/shared/utils.js` — `extractApiError`, `bucketSessionsByDay`, date helpers
- `src/shared/SearchableSelect.jsx` — async autocomplete (no react-select)
- `src/app/hooks.js` — `usePrograms`
- `src/app/useConfig.js` — React Query hook for `/config/`
