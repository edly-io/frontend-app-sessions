import React from 'react';
import PropTypes from 'prop-types';
import {
  Navigate,
  Outlet,
  useParams,
  Link,
} from 'react-router-dom';
import { FooterSlot } from '@edx/frontend-component-footer';
import { Badge } from '@openedx/paragon';
import { getConfig } from '@edx/frontend-platform';
import HeaderSlot from '../plugin-slots/HeaderSlot';
import SectionNav from './SectionNav';
import { usePrograms } from './hooks';
import { useConfig } from './useConfig';
import { USER_ROLE } from '../shared/constants';

const STATUS_VARIANTS = {
  active: 'success',
  draft: 'secondary',
  archived: 'danger',
  freezed: 'warning',
};

const STATUS_LABELS = {
  active: 'Active',
  draft: 'Draft',
  archived: 'Archived',
  freezed: 'Frozen',
};

const formatDate = (dateStr) => {
  if (!dateStr) { return null; }
  return new Date(dateStr).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

const SessionsAdminLayout = ({ children = null }) => {
  const { programId } = useParams();
  const { programs, loading, error } = usePrograms();
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;
  const studioBaseUrl = getConfig().STUDIO_BASE_URL || null;

  // Redirect stale/invalid program IDs back to the programs list.
  const isStaleUrl = !loading && !error && programs.length > 0
    && programId && !programs.find((p) => p.id === programId);
  if (isStaleUrl) {
    return <Navigate to="/" replace />;
  }

  const program = programs.find((p) => p.id === programId) || null;
  const statusKey = (program?.status || '').toLowerCase();
  const studioUrl = isAdmin && studioBaseUrl && programId
    ? `${studioBaseUrl.replace(/\/$/, '')}/authoring/programs/${programId}`
    : null;
  const subtitle = [program?.org, program?.programType, program?.batch].filter(Boolean).join(' · ');
  const dateRange = [
    formatDate(program?.startDate),
    formatDate(program?.endDate),
  ].filter(Boolean).join(' – ');
  const metaLine = [subtitle, dateRange].filter(Boolean).join('  ·  ');

  const renderContent = () => {
    if (loading || error || !programs.length) { return null; }
    return children ?? <Outlet />;
  };

  return (
    <>
      <HeaderSlot />
      <main id="main-content" className="d-flex flex-column flex-grow-1">
        <div className="sessions-program-header">
          <Link to="/" className="sessions-program-header__back">
            <span className="sessions-program-header__back-arrow">&#8592;</span>
            Programs
          </Link>

          {program && (
            <div className="sessions-program-header__info">
              <div className="sessions-program-header__top-row">
                <h1 className="sessions-program-header__title">{program.name}</h1>
                <div className="sessions-program-header__top-right">
                  {statusKey && (
                    <Badge variant={STATUS_VARIANTS[statusKey] || 'light'}>
                      {STATUS_LABELS[statusKey] || program.status}
                    </Badge>
                  )}
                  {studioUrl && (
                    <a
                      href={studioUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="sessions-program-header__studio-link"
                    >
                      Manage in Studio ↗
                    </a>
                  )}
                </div>
              </div>
              {metaLine && (
                <p className="sessions-program-header__meta">{metaLine}</p>
              )}
            </div>
          )}

          <div className="sessions-program-header__nav">
            <SectionNav />
          </div>
        </div>

        <div className="sessions-page-content">
          {renderContent()}
        </div>
      </main>
      <FooterSlot />
    </>
  );
};

SessionsAdminLayout.propTypes = {
  children: PropTypes.node,
};

export default SessionsAdminLayout;
