import React from 'react';
import { Outlet } from 'react-router-dom';

import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';
import AttendanceSubNav from './AttendanceSubNav';

// Layout for the attendance area. Renders a role-aware sub-nav above the
// active sub-page (admin: Sessions / Course Summary / Per-Session / Per-Learner;
// learner: only My Attendance — sub-nav hides when the rail has just one item).
const AttendancePage = () => {
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;
  return (
    <>
      <AttendanceSubNav isAdmin={isAdmin} />
      <Outlet />
    </>
  );
};

export default AttendancePage;
