import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';

const AttendanceIndexRedirect = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();
  const role = config?.user_role;

  if (role === USER_ROLE.INSTRUCTOR) {
    return <Navigate replace to={`/${programId}/calendar`} />;
  }
  const target = role === USER_ROLE.ADMIN ? 'dashboard' : 'me';
  return <Navigate replace to={`/${programId}/attendance/${target}`} />;
};

export default AttendanceIndexRedirect;
