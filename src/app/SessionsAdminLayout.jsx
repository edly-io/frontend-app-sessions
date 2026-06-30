import React from 'react';
import PropTypes from 'prop-types';
import {
  Navigate, Outlet, useLocation, useParams,
} from 'react-router-dom';
import { FooterSlot } from '@edx/frontend-component-footer';
import HeaderSlot from '../plugin-slots/HeaderSlot';
import ProgramSelector from './ProgramSelector';
import SectionNav from './SectionNav';
import { usePrograms } from './hooks';

const sectionFromPath = (pathname) => {
  const parts = pathname.split('/').filter(Boolean);
  return parts[1] || 'calendar';
};

const SessionsAdminLayout = ({ children }) => {
  const { pathname } = useLocation();
  const { programId } = useParams();
  const section = sectionFromPath(pathname);
  const { programs, loading, error } = usePrograms();

  // Redirect stale/invalid program IDs to the landing resolver so it
  // picks the correct program from the API response.
  const isStaleUrl = !loading && !error && programs.length > 0
    && programId && !programs.find((p) => p.id === programId);
  if (isStaleUrl) {
    return <Navigate to="/" replace />;
  }

  const renderContent = () => {
    if (loading || error || !programs.length) { return null; }
    return children ?? <Outlet />;
  };

  return (
    <>
      <HeaderSlot />
      <main id="main-content" className="container-fluid py-3 d-flex flex-column flex-grow-1">
        <div className="mb-3">
          <ProgramSelector section={section} programs={programs} loading={loading} error={error} />
        </div>
        <SectionNav />
        <div key={programId} className="pt-3">
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

SessionsAdminLayout.defaultProps = {
  children: null,
};

export default SessionsAdminLayout;
