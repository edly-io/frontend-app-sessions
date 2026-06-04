import React from 'react';

import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';
import AdminRequestsView from './AdminRequestsView';
import InstructorRequestsView from './InstructorRequestsView';
import LearnerRequestsView from './LearnerRequestsView';

const RequestsPage = () => {
  const { data: config } = useConfig();
  const userRole = config?.user_role ?? USER_ROLE.LEARNER;

  if (userRole === USER_ROLE.ADMIN) { return <AdminRequestsView />; }
  if (userRole === USER_ROLE.INSTRUCTOR) { return <InstructorRequestsView />; }
  return <LearnerRequestsView />;
};

export default RequestsPage;
