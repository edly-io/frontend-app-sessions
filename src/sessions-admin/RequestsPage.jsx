import React from 'react';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';

import StudentRequestsTab from '../sessions-tab/StudentRequestsTab';
import MyRequestsView from './MyRequestsView';

// Role-aware Requests tab. Admin sees the cross-course review queue (existing
// StudentRequestsTab without a `courseId` filter); everyone else sees their
// own requests across all sessions.
const RequestsPage = () => {
  const { administrator } = getAuthenticatedUser() || {};

  if (administrator) {
    return <StudentRequestsTab />;
  }
  return <MyRequestsView />;
};

export default RequestsPage;
