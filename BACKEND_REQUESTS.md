# Backend Change Requests

Tracks all changes we need from the backend team for this MFE.
Each item includes the problem, frontend impact, and requested fix.

Backend lives at:
`../tutor-contrib-fbr/tutorfbr/templates/fbr/openedx-features-fbr/fbr/lms/attendance/`

---

## Open Requests

### ✓ Studio programs views — CSRF trusted origins for MFE mutations

**Resolved.** Added `CSRF_TRUSTED_ORIGINS.append(MFE_HOST)` to both `openedx-cms-production-settings` and `openedx-cms-development-settings` tutor patches. Django's `CSRF_TRUSTED_ORIGINS` exempts requests originating from the listed hosts from the CSRF cookie-match check, so the MFE can now PATCH/POST/DELETE to the Studio programs API without needing Studio's CSRF cookie.

---

### ⏳ `GET /v1/approved-leaves/` (or equivalent) — approved leaves for calendar display

**Problem.** The calendar needs to show learners which sessions are covered by an approved leave (strikethrough chip, non-clickable leave tile). The current requests list (`GET /v1/requests/`) returns all requests in all states — PENDING, APPROVED, REJECTED. Filtering client-side on `state=APPROVED` leaks rejected requests to the browser and makes it impossible to distinguish "no longer on leave" (rejected) from "on leave" (approved).

`AttendanceRecord` rows with `authorised_absent` status are only written when the admin finalises attendance for a session (roster mark) — not at approval time — so they cannot be used for future sessions.

**What we need.** A lightweight read endpoint scoped to the authenticated learner that returns only their **APPROVED** leave requests (or a derived "leave windows" representation). Minimum payload per entry:
- `id`
- `type` (`leave`)
- `sessions` — list of `{ id }` for session-specific leaves
- `leave_start_date` / `leave_end_date` — for full-day leaves

`GET /v1/requests/?state=APPROVED&type=leave&program_key=…` would work if filtering by `state` is added to the role-scoped list endpoint, or a dedicated `/v1/approved-leaves/` endpoint.

**Frontend impact.** Calendar leave hydration (session strikethrough chips, leave day tiles) is currently disabled and returns an empty map. Will be re-enabled once this endpoint is available.

---

## Resolved / Acknowledged

### ✓ Full-day leave with no sessions in the date range
**Resolved.** `session_ids` on `RequestSerializer` is now `required=False, allow_empty=True`. `validate_session_ids` skips the empty check; `validate()` enforces non-empty only for non-leave types. `create_request` service likewise skips the empty guard for `type == 'leave'`. `CreateRequestModal` already sends an empty list and validates without sessions for full-day leave.

### ✓ `submitter_name` added to `GET /v1/requests/` response
**Resolved.** `RequestSerializer` now includes `submitter_name` as a read-only `SerializerMethodField` returning `get_full_name() or username`. `AdminRequestsView` Submitter column shows the full name with email as a sub-line.

### ✓ Date-window filter on `GET /v1/requests/` — `?start_date=` / `?end_date=`
**Resolved.** `_apply_optional_filters` in `RequestViewSet` now applies `created__date__gte` / `created__date__lte` when `start_date` / `end_date` params are present. Both request views already send these params.

### ✓ `DELETE /v1/requests/{pk}/` — learner deletes own PENDING request
**Resolved.** `RequestViewSet` now includes a `destroy` action restricted to the request owner and only while `state == PENDING`. URL wired at `DELETE /v1/requests/<pk>/`. `LearnerRequestsView` Delete button is now functional with an inline confirm step.

### ✓ Submitter info in `GET /v1/requests/` serializer
**Resolved.** `RequestSerializer` now includes `submitter_name` (`get_full_name() or username`) and `submitter_email` as read-only `SerializerMethodField`s. `AdminRequestsView` / `InstructorRequestsView` render them in the Submitter column.

### ✓ Session-level leave payload (`leave_session_ids`)
**Resolved.** `leave_request` now accepts `leave_session_ids: [uuid, ...]` as an alternative to `leave_days`. Serializer validates session existence and stores as `data.leave_session_ids`. `_mark_leave_attendance` creates `authorised_absent` records for exactly those sessions on approval. `CreateRequestModal` Session-Specific mode is now fully enabled. `CalendarPage` leave hydration handles `leave_session_ids` for chip strikethrough.

### ✓ Date-window filter on `GET /v1/requests/me/`
**Resolved.** `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` filters by `created__date`. `getMyRequests` API function now accepts and passes these params.

### ✓ `conflict_detection.py` — richer entity data for `INSTRUCTOR_DOUBLE_BOOKING` and `ROOM_DOUBLE_BOOKING`
**Resolved.** `check_instructor_double_booking` now returns `program_key`, `scheduled_start_time`, `scheduled_end_time` per conflicting instructor. `check_room_double_booking` fetches the conflicting session via `.values(...)` and returns the same three fields. Frontend renders them conditionally.

---

## Resolved / Acknowledged

### ✓ `conflict_detection.py` bug — `holiday.date` AttributeError
**Resolved.** `services/conflict_detection.py` updated to query `start_date__lte / end_date__gte` and reference `holiday.start_date` instead of the non-existent `holiday.date`.

### ✓ Calendar program scoping — `?program_key=` filter on `/v1/calendar-sessions/`
**Resolved.** `CalendarSessionListView.get()` now filters by `program_key` when the query param is present, and `CalendarSessionSerializer` includes `program_key` as a read-only field. Frontend already passes `?program_key=<programId>` — no frontend changes needed.

### ✓ Programs API host — use `STUDIO_BASE_URL`
**Resolved.** `GET /fbr/api/programs/` is mounted on the CMS (`ProjectType.CMS`). Frontend updated to call `${STUDIO_BASE_URL}/fbr/api/programs/` in `src/app/api.js`. `STUDIO_BASE_URL` must be set in the MFE's env config (e.g. tutor patch for `mfe-lms-*-settings`).
