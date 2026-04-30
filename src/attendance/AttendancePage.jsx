import React from 'react';
import { Outlet } from 'react-router-dom';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';

import AttendanceSubNav from './AttendanceSubNav';

// Layout for the attendance area. Renders a role-aware sub-nav above the
// active sub-page (admin: Sessions / Course Summary / Per-Session / Per-Learner;
// learner: only My Attendance — sub-nav hides when the rail has just one item).
const AttendancePage = () => {
  const { administrator } = getAuthenticatedUser() || {};
  return (
    <>
      <AttendanceSubNav isAdmin={Boolean(administrator)} />
      <Outlet />
    </>
  );
};

export default AttendancePage;
