import React from 'react';
import { Button, ButtonGroup } from '@openedx/paragon';
import {
  Navigate, Outlet, useParams, useSearchParams,
} from 'react-router-dom';

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
        <div className="d-flex justify-content-end mb-3">
          <ButtonGroup size="sm">
            <Button
              variant={activeView === 'list' ? 'primary' : 'outline-primary'}
              size="sm"
              aria-pressed={activeView === 'list'}
              onClick={() => handleViewChange('list')}
            >
              Attendance
            </Button>
            <Button
              variant={activeView === 'audit-log' ? 'primary' : 'outline-primary'}
              size="sm"
              aria-pressed={activeView === 'audit-log'}
              onClick={() => handleViewChange('audit-log')}
            >
              Audit Log
            </Button>
          </ButtonGroup>
        </div>
      )}

      {isAdmin && activeView === 'audit-log' ? (
        <div className="audit-log-view">
          <AuditLogTable
            appLabel="attendance"
            models={['attendancerecord']}
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
