// AuthGate — block unauthenticated access to the sessions-admin area.
// If no user is signed in, push them to the LMS login page with a `next=`
// pointing back to the page they tried to open. Render a spinner during the
// redirect so we never flash the un-gated content.

import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { Container, Spinner } from '@openedx/paragon';
import { getAuthenticatedUser, redirectToLogin } from '@edx/frontend-platform/auth';

const AuthGate = ({ children }) => {
  const user = getAuthenticatedUser();

  useEffect(() => {
    if (!user) {
      redirectToLogin(window.location.href);
    }
  }, [user]);

  if (!user) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" screenReaderText="Redirecting to sign in" />
      </Container>
    );
  }

  return children;
};

AuthGate.propTypes = {
  children: PropTypes.node.isRequired,
};

export default AuthGate;
