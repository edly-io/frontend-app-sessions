import React, { useState } from 'react';
import { Navigate, Outlet, useParams, useSearchParams } from 'react-router-dom';

import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';
import AttendanceSubNav from './AttendanceSubNav';
import AuditLogTable from '../shared/AuditLogTable';

const AttendancePage = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();
  const role = config?.user_role;
  const isAdmin = role === USER_ROLE.ADMIN;

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

  if (role === USER_ROLE.INSTRUCTOR) {
    return <Navigate replace to={`/${programId}/calendar`} />;
  }

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
              {view === 'list' ? 'Attendance' : 'Audit Log'}
            </button>
          ))}
        </div>
      )}

      {isAdmin && activeView === 'audit-log' ? (
        <div className="audit-log-view">
          <AuditLogTable
            appLabel="attendance"
            models={["attendancerecord"]}
            programKey={programId}
            recordFilter={recordFilter}
            onClearFilter={handleClearFilter}
          />
        </div>
      ) : (
        <>
          {isAdmin && <AttendanceSubNav />}
          <Outlet />
        </>
      )}
    </>
  );
};

export default AttendancePage;
