# Backend Change Requests

Tracks all changes we need from the backend team for this MFE.
Each item includes the problem, frontend impact, and requested fix.

Backend lives at:
`../tutor-contrib-fbr/tutorfbr/templates/fbr/openedx-features-fbr/fbr/lms/attendance/`

---

## Open Requests

### Consistent per-row fields across roster and trainee attendance endpoints

**Problem.** The two main attendance endpoints return inconsistent fields, making it impossible to show the same columns in both the By Course (roster) and By Learner tabs.

| Field | `GET /sessions/{id}/attendance-roster/` | `GET /trainees/{id}/attendance/` |
|---|---|---|
| `source` | ✓ | ✓ |
| `overridden_by_email` | ✗ missing | ✓ |
| `override_reason` | ✗ missing | ✓ |
| `record_id` | ✓ | ✗ uses `id` instead |
| `notes` | ✓ | ✗ missing |
| `marking_window_open` | session-level only | ✗ missing |

**Requested fixes.**

1. **Roster** (`_row_from_record` / `_derived_row` in `roster_service.py`): add `overridden_by_email` and `override_reason` per row.
2. **Trainee endpoint** (`AttendanceRecordListSerializer`): add `notes`, `marking_window_open` (from the session FK), and expose `record_id` as an alias for `id` (or rename to `record_id` to match the roster) — frontend uses `record_id` to determine whether a change-reason modal is needed and whether the note button should appear.

**Frontend impact.** Until resolved: roster hides "Marked by" and shows only pending change reason (not historical); By Learner tab cannot gate edit buttons on window state (errors on closed-window attempts) and note button is hidden (no `notes` field). Frontend workaround: falls back to `row.id` for the record identity check.




---

## Resolved / Acknowledged

### ✓ Per-learner attendance history — `GET /v1/trainees/{id}/attendance/?course_id=`

**Resolved.** Replaces the deprecated `GET /v1/records/?user_id&course_id` (which returned `count:0` for unmarked sessions). New endpoint derives pending/leave at read time. `PerLearnerView` and `PerLearnerHistoryReport` now call `getTraineeAttendance(userId, { courseId })`.

### ✓ Course attendance summary — `GET /v1/courses/{id}/attendance-summary/`

**Resolved.** Returns per-learner rollup (present/absent/leave/pending counts + `attendance_rate`). `CourseSummaryReport` revived and routed at `attendance/summary`.

### ✓ Learner list for Per-Learner view — use program enrollment (`/programs/users/?role=learner`)

**Resolved.** `PerLearnerView` now fetches learners via `GET /fbr/api/programs/users/?role=learner&no_page&program_key=<key>` (the same programs API used for instructors). Learners are loaded at mount alongside courses. `getCourseEnrolledLearners` removed.

### ✓ Course sessions endpoint — dedicated `GET /v1/courses/{id}/sessions/` *(was: `?course_id=` filter)*

**Resolved.** Rather than adding a filter param to `GET /v1/sessions/`, the backend added a new `CourseSessionListView` at `GET /v1/courses/{course_id}/sessions/?program_key=<key>`. Returns all sessions for the course; fields: `id`, `title`, `session_type`, `scheduled_start_time`, `scheduled_end_time`, `status`, `marking_window_open`. `PerCourseView` now calls `getCourseSessionsList(courseKey, programKey)` for real courses and keeps `getSessionsPage` only for the "no course" (`__none__`) case. Client-side filter by `course_id` removed.

### ✓ Roster endpoint — `notes` field per row

**Resolved.** `GET /v1/sessions/{id}/attendance-roster/` rows now include `notes` (string for real records, `null` for derived rows). `AttendanceRosterPage` `NoteCell` shows 💬 when `notes` is non-empty and `+` otherwise. No more lazy API call on note icon click.

### ✓ Notes write support — `mark-attendance` accepts optional `notes` per record

**Resolved.** Option A implemented: `POST /v1/sessions/{id}/mark-attendance/` records payload now accepts an optional `"notes"` field per record. Note-only changes don't set `is_overridden`. `AttendanceRosterPage` note modal Save button is now active — saves via `markAttendance` and updates the roster in-place.

### ✓ Studio programs views — CSRF trusted origins for MFE mutations

**Resolved.** Added `CSRF_TRUSTED_ORIGINS.append(MFE_HOST)` to both `openedx-cms-production-settings` and `openedx-cms-development-settings` tutor patches. Django's `CSRF_TRUSTED_ORIGINS` exempts requests originating from the listed hosts from the CSRF cookie-match check, so the MFE can now PATCH/POST/DELETE to the Studio programs API without needing Studio's CSRF cookie.

### ✓ `GET /v1/approved-leaves/` — approved leaves for calendar display

**Resolved.** `getApprovedLeaves()` is live and used in CalendarPage for leave overlay (session strikethrough chips, leave day tiles).

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
