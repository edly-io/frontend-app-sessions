// RequireAdmin — block non-admin signed-in users from admin-only sessions
// routes (holidays, locations, etc.). Must be rendered OUTSIDE
// SessionsAdminLayout so the sidebar / program selector / section nav never
// render for users who shouldn't see them.
//
// Logged-out users are handled upstream by AuthGate; by the time RequireAdmin
// runs we already have an authenticated user and can fetch the session config.

import React from 'react';
import PropTypes from 'prop-types';
import { Container, Spinner } from '@openedx/paragon';

import { useConfig } from './useConfig';
import { USER_ROLE } from '../shared/constants';
import UnauthorizedPage from './UnauthorizedPage';

const RequireAdmin = ({ children }) => {
  const { data: config, isLoading } = useConfig();

  if (isLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" screenReaderText="Checking access" />
      </Container>
    );
  }

  if (config?.user_role !== USER_ROLE.ADMIN) {
    return <UnauthorizedPage />;
  }

  return children;
};

RequireAdmin.propTypes = {
  children: PropTypes.node.isRequired,
};

export default RequireAdmin;
