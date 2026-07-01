import React from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';

import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';
import AttendanceSubNav from './AttendanceSubNav';

const AttendancePage = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();
  const role = config?.user_role;

  if (role === USER_ROLE.INSTRUCTOR) {
    return <Navigate replace to={`/${programId}/calendar`} />;
  }

  return (
    <>
      {role === USER_ROLE.ADMIN && <AttendanceSubNav />}
      <Outlet />
    </>
  );
};

export default AttendancePage;
