// Full-viewport unauthorized screen for signed-in non-admin users who try to
// deep-link into an admin-only sessions URL (holidays, locations, etc.).
// Deliberately rendered OUTSIDE SessionsAdminLayout so the sidebar / program
// selector / section nav never leak to users who shouldn't see them.

import React from 'react';
import { Button, Card, Icon } from '@openedx/paragon';
import { Lock } from '@openedx/paragon/icons';
import { Link } from 'react-router-dom';

import './unauthorized-page-styles.scss';

// Hardcoded to avoid a dependency cycle with `./routes` (which imports
// RequireAdmin, which imports this file). Must match SESSIONS_DASHBOARD_PATH
// in src/app/routes.tsx.
const DASHBOARD_PATH = '/dashboard';

const UnauthorizedPage = () => (
  <div className="sessions-unauthorized-page">
    <Card className="sessions-unauthorized-page__card">
      <Card.Section className="sessions-unauthorized-page__card-section">
        <Icon
          src={Lock}
          className="sessions-unauthorized-page__icon"
          screenReaderText=""
        />
        <h1 className="sessions-unauthorized-page__title h4">
          You are not authorized to view this page
        </h1>
        <p className="sessions-unauthorized-page__body">
          This section is restricted to administrators. If you feel you should
          have access, please reach out to your administrator.
        </p>
        <Button
          as={Link}
          to={DASHBOARD_PATH}
          variant="primary"
          className="sessions-unauthorized-page__action"
        >
          Return to dashboard
        </Button>
      </Card.Section>
    </Card>
  </div>
);

export default UnauthorizedPage;
