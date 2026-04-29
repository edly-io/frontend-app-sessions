import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';

// Bare `/sessions/:programId/attendance` resolves to the role's default
// sub-page: Sessions list for admins, My Attendance for everyone else.
const AttendanceIndexRedirect = () => {
  const { programId } = useParams();
  const { administrator } = getAuthenticatedUser() || {};
  const target = administrator ? 'sessions' : 'me';
  return <Navigate replace to={`/sessions/${programId}/attendance/${target}`} />;
};

export default AttendanceIndexRedirect;
