import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import { PageWrap } from '@edx/frontend-platform/react';

import CalendarPage from '../calendar/CalendarPage';
import AuthGate from './AuthGate';
import SessionsAdminLayout from './SessionsAdminLayout';
import SessionsLanding from './SessionsLanding';
import RequestsPage from '../requests/RequestsPage';
import AttendancePage from '../attendance/AttendancePage';
import AttendanceIndexRedirect from '../attendance/AttendanceIndexRedirect';
import AdminSessionsList from '../attendance/AdminSessionsList';
import AttendanceRosterPage from '../attendance/AttendanceRosterPage';
import MyAttendanceView from '../attendance/MyAttendanceView';
import PerLearnerHistoryReport from '../attendance/reports/PerLearnerHistoryReport';
import CourseSummaryReport from '../attendance/reports/CourseSummaryReport';
import LocationsPage from '../locations/LocationsPage';

/**
 * Route paths owned by the sessions-admin area. Importing from here keeps
 * top-level `src/constants.ts` and `src/index.jsx` free of sessions-admin
 * specifics — the area owns its own paths.
 */
// Deprecated alias — old `/sessions/calendar` bookmarks redirect into the
// landing resolver below.
export const LEGACY_CALENDAR_PATH = '/sessions/calendar';
// Bare entry: silent resolver picks the first program and forwards to its
// calendar.
export const SESSIONS_ROOT_PATH = '/sessions';
// Program-scoped sections.
export const SESSIONS_CALENDAR_PATH = '/sessions/:programId/calendar';
export const SESSIONS_REQUESTS_PATH = '/sessions/:programId/requests';
export const SESSIONS_ATTENDANCE_PATH = '/sessions/:programId/attendance';
export const SESSIONS_LOCATIONS_PATH = '/sessions/:programId/locations';

const wrapInShell = (Component: React.ComponentType) => (
  <PageWrap>
    <AuthGate>
      <SessionsAdminLayout>
        <Component />
      </SessionsAdminLayout>
    </AuthGate>
  </PageWrap>
);

// Fragment children render correctly as direct children of `<Routes>` in
// React Router 6 — the router walks through the fragment when collecting
// route definitions.
export const sessionsAdminRoutes = (
  <>
    <Route
      path="/"
      element={<Navigate to={SESSIONS_ROOT_PATH} replace />}
    />
    <Route
      path={LEGACY_CALENDAR_PATH}
      element={<Navigate to={SESSIONS_ROOT_PATH} replace />}
    />
    <Route
      path={SESSIONS_ROOT_PATH}
      element={<PageWrap><AuthGate><SessionsLanding /></AuthGate></PageWrap>}
    />
    <Route path={SESSIONS_CALENDAR_PATH} element={wrapInShell(CalendarPage)} />
    <Route path={SESSIONS_REQUESTS_PATH} element={wrapInShell(RequestsPage)} />
    <Route path={SESSIONS_LOCATIONS_PATH} element={wrapInShell(LocationsPage)} />
    {/* Attendance tab is a layout route — children render inside the
        AttendancePage shell's <Outlet />. Sub-paths follow the role-aware
        pill nav: admin gets sessions/summary/by-session/by-learner; learner
        gets only `me`. The index route role-redirects. */}
    <Route path={SESSIONS_ATTENDANCE_PATH} element={wrapInShell(AttendancePage)}>
      <Route index element={<AttendanceIndexRedirect />} />
      <Route path="sessions" element={<AdminSessionsList />} />
      <Route path="sessions/:sessionId" element={<AttendanceRosterPage />} />
      <Route path="me" element={<MyAttendanceView />} />
      <Route path="by-learner" element={<PerLearnerHistoryReport />} />
      <Route path="summary" element={<CourseSummaryReport />} />
    </Route>
  </>
);
