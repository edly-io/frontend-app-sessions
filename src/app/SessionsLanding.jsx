import React from 'react';
import { defineMessages, useIntl } from '@edx/frontend-platform/i18n';
import { Alert, Container, Spinner } from '@openedx/paragon';

import ProgramsListPage from '../programs/ProgramsListPage';
import TraineeDashboardPage from '../trainee-dashboard/TraineeDashboardPage';
import { FBR_ROLE } from '../shared/constants';
import { useMyFbrRoles } from './useMyFbrRoles';

const messages = defineMessages({
  loading: {
    id: 'sessions.landing.loading',
    defaultMessage: 'Loading dashboard',
    description: 'Accessible loading message while the Sessions homepage determines which page to show.',
  },
  error: {
    id: 'sessions.landing.error',
    defaultMessage: 'We could not load your dashboard. Please refresh the page and try again.',
    description: 'Error shown when the Sessions homepage cannot determine the current user roles.',
  },
});

const SessionsLanding = () => {
  const intl = useIntl();
  const { data: fbrRoles = [], isLoading, isError } = useMyFbrRoles();
  const hasTraineeRole = fbrRoles.includes(FBR_ROLE.TRAINEE);

  if (process.env.NODE_ENV !== 'test') {
    // Temporary diagnostics for confirming the running MFE bundle and role payload.
    // eslint-disable-next-line no-console
    console.info('[SessionsLanding] trainee dashboard role gate', {
      path: window.location.pathname,
      rolesUrl: '/fbr/api/biodata/v1/users/me/',
      isLoading,
      isError,
      fbrRoles,
      hasTraineeRole,
    });
  }

  // Wait for the role response before rendering either page so trainee-only
  // content never flashes for users whose access has not been confirmed.
  if (isLoading) {
    return (
      <Container className="py-5 text-center">
        <Spinner
          animation="border"
          screenReaderText={intl.formatMessage(messages.loading)}
        />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container className="py-5">
        <Alert variant="danger">
          {intl.formatMessage(messages.error)}
        </Alert>
      </Container>
    );
  }

  return hasTraineeRole
    ? <TraineeDashboardPage />
    : <ProgramsListPage />;
};

export default SessionsLanding;
