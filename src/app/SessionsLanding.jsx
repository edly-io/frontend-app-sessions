import React from 'react';
import { defineMessages, useIntl } from '@edx/frontend-platform/i18n';
import { Alert, Container, Spinner } from '@openedx/paragon';
import { useSearchParams } from 'react-router-dom';

import ProfileSwitcher from '../dashboard/ProfileSwitcher';
import InstructorDashboardPage from '../instructor-dashboard/InstructorDashboardPage';
import ProgramsListPage from '../programs/ProgramsListPage';
import { FBR_ROLE } from '../shared/constants';
import TraineeDashboardPage from '../trainee-dashboard/TraineeDashboardPage';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: fbrRoles = [], isLoading, isError } = useMyFbrRoles();
  const hasTraineeRole = fbrRoles.includes(FBR_ROLE.TRAINEE);
  const hasInstructorRole = fbrRoles.includes(FBR_ROLE.INSTRUCTOR);
  const requestedProfile = searchParams.get('profile');
  const activeProfile = requestedProfile === FBR_ROLE.INSTRUCTOR
    ? FBR_ROLE.INSTRUCTOR
    : FBR_ROLE.TRAINEE;

  if (process.env.NODE_ENV !== 'test') {
    // Temporary diagnostics for confirming the running MFE bundle and role payload.
    // eslint-disable-next-line no-console
    console.info('[SessionsLanding] profile dashboard role gate', {
      path: window.location.pathname,
      rolesUrl: '/fbr/api/biodata/v1/users/me/',
      isLoading,
      isError,
      fbrRoles,
      hasTraineeRole,
      hasInstructorRole,
      activeProfile: hasTraineeRole && hasInstructorRole ? activeProfile : undefined,
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

  if (hasTraineeRole && hasInstructorRole) {
    const handleProfileSelect = (profile) => {
      if (profile !== FBR_ROLE.TRAINEE && profile !== FBR_ROLE.INSTRUCTOR) {
        return;
      }

      const nextSearchParams = new URLSearchParams(searchParams);
      nextSearchParams.set('profile', profile);
      setSearchParams(nextSearchParams, { replace: true });
    };
    const profileSwitcher = (
      <ProfileSwitcher
        activeProfile={activeProfile}
        onSelect={handleProfileSelect}
      />
    );

    return activeProfile === FBR_ROLE.INSTRUCTOR
      ? <InstructorDashboardPage profileSwitcher={profileSwitcher} />
      : <TraineeDashboardPage profileSwitcher={profileSwitcher} />;
  }

  if (hasInstructorRole) {
    return <InstructorDashboardPage />;
  }

  if (hasTraineeRole) {
    return <TraineeDashboardPage />;
  }

  return <ProgramsListPage />;
};

export default SessionsLanding;
