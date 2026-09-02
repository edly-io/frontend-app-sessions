import React from 'react';
import PropTypes from 'prop-types';
import { Container } from '@openedx/paragon';
import { FooterSlot } from '@edx/frontend-component-footer';

import HeaderSlot from '../plugin-slots/HeaderSlot';

const DashboardShell = ({ children, className, profileSwitcher = null }) => (
  <>
    <HeaderSlot />
    <main id="main-content" className={className}>
      <Container size="xl">
        {profileSwitcher}
        {children}
      </Container>
    </main>
    <FooterSlot />
  </>
);

DashboardShell.propTypes = {
  children: PropTypes.node.isRequired,
  className: PropTypes.string.isRequired,
  profileSwitcher: PropTypes.node,
};

export default DashboardShell;
