import React from 'react';
import PropTypes from 'prop-types';
import { Navigate } from 'react-router-dom';
import { Container, Spinner, Alert } from '@openedx/paragon';
import { FooterSlot } from '@edx/frontend-component-footer';
import HeaderSlot from '../plugin-slots/HeaderSlot';
import { usePrograms } from './hooks';

const Chrome = ({ children }) => (
  <>
    <HeaderSlot />
    <main id="main-content" className="container-fluid py-3 d-flex flex-column flex-grow-1">
      {children}
    </main>
    <FooterSlot />
  </>
);

Chrome.propTypes = {
  children: PropTypes.node.isRequired,
};

const SessionsLanding = () => {
  const { programs, loading, error } = usePrograms();

  if (loading) {
    return (
      <Chrome>
        <Container className="py-5 text-center">
          <Spinner animation="border" screenReaderText="Loading programs" />
        </Container>
      </Chrome>
    );
  }

  if (error) {
    return (
      <Chrome>
        <Container className="py-5">
          <Alert variant="danger">{error}</Alert>
        </Container>
      </Chrome>
    );
  }

  if (!programs.length) {
    return (
      <Chrome>
        <Container className="py-5">
          <Alert variant="info">No programs available.</Alert>
        </Container>
      </Chrome>
    );
  }

  return <Navigate replace to={`/sessions/${programs[0].id}/calendar`} />;
};

export default SessionsLanding;
