import React from 'react';
import PropTypes from 'prop-types';
import { Outlet, useLocation } from 'react-router-dom';
import { FooterSlot } from '@edx/frontend-component-footer';
import HeaderSlot from '../plugin-slots/HeaderSlot';
import ProgramSelector from './ProgramSelector';
import SectionNav from './SectionNav';

const sectionFromPath = (pathname) => {
  const parts = pathname.split('/').filter(Boolean);
  return parts[2] || 'calendar';
};

const SessionsAdminLayout = ({ children }) => {
  const { pathname } = useLocation();
  const section = sectionFromPath(pathname);

  return (
    <>
      <HeaderSlot />
      <main id="main-content" className="container-fluid py-3 d-flex flex-column flex-grow-1">
        <div className="mb-3">
          <ProgramSelector section={section} />
        </div>
        <SectionNav />
        <div className="pt-3">
          {children ?? <Outlet />}
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
