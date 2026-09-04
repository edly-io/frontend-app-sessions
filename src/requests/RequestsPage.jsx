import React from 'react';
import PropTypes from 'prop-types';
import { Outlet, useParams, useSearchParams } from 'react-router-dom';

import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';
import AdminRequestsView from './AdminRequestsView';
import InstructorRequestsView from './InstructorRequestsView';
import LearnerRequestsView from './LearnerRequestsView';
import RequestsSubNav from './RequestsSubNav';
import AuditLogTable from '../shared/AuditLogTable';

// Renders the role-appropriate view for a single request type tab.
// Used as the element for /:programId/requests/leaves and /remote-sessions.
export const RequestsTabPage = ({ lockedType }) => {
  const { data: config } = useConfig();
  const userRole = config?.user_role ?? USER_ROLE.LEARNER;
  if (userRole === USER_ROLE.ADMIN) {
    return <AdminRequestsView lockedType={lockedType} />;
  }
  if (userRole === USER_ROLE.INSTRUCTOR) {
    return <InstructorRequestsView lockedType={lockedType} />;
  }
  return <LearnerRequestsView lockedType={lockedType} />;
};

RequestsTabPage.propTypes = {
  lockedType: PropTypes.string.isRequired,
};

// Layout route: renders the sub-nav tabs above whichever tab is active.
// Admins get a top-level "Requests | Audit Log" toggle.
const RequestsPage = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = searchParams.get('view') || 'list';
  const recordFilter = searchParams.get('record_id') || undefined;

  const handleViewChange = (view) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', view);
      if (view !== 'audit-log') { next.delete('record_id'); }
      return next;
    });
  };
  const handleClearFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('record_id');
      return next;
    });
  };

  return (
    <>
      {isAdmin && (
        <div className="page-view-toggle">
          {['list', 'audit-log'].map(view => (
            <button
              key={view}
              type="button"
              onClick={() => handleViewChange(view)}
              className={`page-view-toggle__tab${activeView === view ? ' page-view-toggle__tab--active' : ''}`}
            >
              {view === 'list' ? 'Requests' : 'Audit Log'}
            </button>
          ))}
        </div>
      )}

      {isAdmin && activeView === 'audit-log' ? (
        <div className="audit-log-view">
          <AuditLogTable
            appLabel="attendance"
            models={["leaverequest", "remotesessionrequest", "substituterequest"]}
            programKey={programId}
            recordFilter={recordFilter}
            onClearFilter={handleClearFilter}
          />
        </div>
      ) : (
        <>
          <RequestsSubNav />
          <Outlet />
        </>
      )}
    </>
  );
};

export default RequestsPage;
