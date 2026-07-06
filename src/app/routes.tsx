import React from 'react';
import { Route, Navigate } from 'react-router-dom';
import { PageWrap } from '@edx/frontend-platform/react';

import CalendarPage from '../calendar/CalendarPage';
import AuthGate from './AuthGate';
import SessionsAdminLayout from './SessionsAdminLayout';
import SessionsLanding from './SessionsLanding';
import RequestsPage, { RequestsTabPage } from '../requests/RequestsPage';
import SubstituteRequestsView from '../requests/SubstituteRequestsView';
import { REQUEST_TYPE } from '../shared/constants';
import AttendancePage from '../attendance/AttendancePage';
import AttendanceIndexRedirect from '../attendance/AttendanceIndexRedirect';
import AttendanceRosterPage from '../attendance/AttendanceRosterPage';
import MyAttendanceView from '../attendance/MyAttendanceView';
import PerCourseView from '../attendance/PerCourseView';
import PerLearnerView from '../attendance/PerLearnerView';
import CourseSummaryReport from '../attendance/reports/CourseSummaryReport';
import LocationsPage from '../locations/LocationsPage';
import HolidaysPage from '../holidays/HolidaysPage';

/**
 * Route paths owned by the sessions-admin area. Importing from here keeps
 * top-level `src/constants.ts` and `src/index.jsx` free of sessions-admin
 * specifics — the area owns its own paths.
 *
 * Paths are relative to the MFE basename (`PUBLIC_PATH=/sessions/`) which
 * `AppProvider`'s `<BrowserRouter basename>` strips before matching. So a
 * route declared `/` matches the URL `/sessions`, `/:programId/calendar`
 * matches `/sessions/<id>/calendar`, etc.
 */
// Deprecated alias — old `/sessions/calendar` bookmarks (relative `/calendar`
// under the MFE basename) redirect into the landing resolver below.
export const LEGACY_CALENDAR_PATH = '/calendar';
// Bare entry: silent resolver picks the first program and forwards to its
// calendar.
export const SESSIONS_ROOT_PATH = '/';
// Program-scoped sections.
export const SESSIONS_CALENDAR_PATH = '/:programId/calendar';
export const SESSIONS_REQUESTS_PATH = '/:programId/requests';
export const SESSIONS_ATTENDANCE_PATH = '/:programId/attendance';
export const SESSIONS_LOCATIONS_PATH = '/:programId/locations';
export const SESSIONS_HOLIDAYS_PATH = '/:programId/holidays';

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
      path={LEGACY_CALENDAR_PATH}
      element={<Navigate to={SESSIONS_ROOT_PATH} replace />}
    />
    <Route
      path={SESSIONS_ROOT_PATH}
      element={<PageWrap><AuthGate><SessionsLanding /></AuthGate></PageWrap>}
    />
    <Route path={SESSIONS_CALENDAR_PATH} element={wrapInShell(CalendarPage)} />
    <Route path={SESSIONS_REQUESTS_PATH} element={wrapInShell(RequestsPage)}>
      <Route index element={<Navigate to="leaves" replace />} />
      <Route path="leaves" element={<RequestsTabPage lockedType={REQUEST_TYPE.LEAVE} />} />
      <Route path="remote-sessions" element={<RequestsTabPage lockedType={REQUEST_TYPE.REMOTE_SESSION} />} />
      <Route path="substitute-requests" element={<SubstituteRequestsView />} />
    </Route>
    <Route path={SESSIONS_LOCATIONS_PATH} element={wrapInShell(LocationsPage)} />
    <Route path={SESSIONS_HOLIDAYS_PATH} element={wrapInShell(HolidaysPage)} />
    {/* Attendance tab is a layout route — children render inside the
        AttendancePage shell's <Outlet />. Admin: by-course / by-learner tabs.
        Learner: my attendance only (no sub-nav). Instructor: redirected away. */}
    <Route path={SESSIONS_ATTENDANCE_PATH} element={wrapInShell(AttendancePage)}>
      <Route index element={<AttendanceIndexRedirect />} />
      <Route path="by-course" element={<PerCourseView />} />
      <Route path="by-learner" element={<PerLearnerView />} />
      <Route path="dashboard" element={<CourseSummaryReport />} />
      <Route path="sessions/:sessionId" element={<AttendanceRosterPage />} />
      <Route path="me" element={<MyAttendanceView />} />
    </Route>
  </>
);
