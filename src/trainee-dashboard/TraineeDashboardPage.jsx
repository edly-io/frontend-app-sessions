import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Card, Col, Form, Row, Spinner,
} from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import DashboardShell from '../dashboard/DashboardShell';
import AttendanceCard from './components/AttendanceCard';
import CertificatesSection from './components/CertificatesSection';
import CoursesSection from './components/CoursesSection';
import DashboardHero from './components/DashboardHero';
import DashboardStats from './components/DashboardStats';
import FeedbackCard from './components/FeedbackCard';
import HolidaysCard from './components/HolidaysCard';
import ProgressCard from './components/ProgressCard';
import UpcomingSessionsCard from './components/UpcomingSessionsCard';
import messages from './messages';
import useTraineeDashboard from './useTraineeDashboard';
import './trainee-dashboard.scss';

const TraineeDashboardPage = ({ profileSwitcher = null }) => {
  const intl = useIntl();
  const [programKey, setProgramKey] = useState();
  const {
    data, isLoading, isError, error, refetch,
  } = useTraineeDashboard(programKey);

  if (isLoading) {
    return (
      <DashboardShell className="trainee-dashboard" profileSwitcher={profileSwitcher}>
        <div className="py-5 text-center">
          <Spinner animation="border" screenReaderText={intl.formatMessage(messages.loading)} />
        </div>
      </DashboardShell>
    );
  }

  if (isError) {
    const detail = error?.response?.data?.error?.detail || error?.response?.data?.detail;
    return (
      <DashboardShell className="trainee-dashboard" profileSwitcher={profileSwitcher}>
        <Alert variant="danger">
          <Alert.Heading>{intl.formatMessage(messages.loadError)}</Alert.Heading>
          {detail && <p>{detail}</p>}
          <Button variant="outline-primary" onClick={() => refetch()}>
            {intl.formatMessage(messages.tryAgain)}
          </Button>
        </Alert>
      </DashboardShell>
    );
  }

  if (!data || data.state === 'no_programme' || !data.programme) {
    return (
      <DashboardShell className="trainee-dashboard" profileSwitcher={profileSwitcher}>
        <Card className="trainee-dashboard__empty-state">
          <Card.Section>
            <h1>{intl.formatMessage(messages.noProgrammeTitle)}</h1>
            <p>{intl.formatMessage(messages.noProgrammeBody)}</p>
          </Card.Section>
        </Card>
        <HolidaysCard holidays={data?.holidays || []} />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell className="trainee-dashboard" profileSwitcher={profileSwitcher}>
      {data.available_programs.length > 1 && (
        <Form.Group controlId="trainee-dashboard-programme" className="trainee-dashboard__programme-switcher">
          <Form.Label>{intl.formatMessage(messages.selectProgramme)}</Form.Label>
          <Form.Control
            as="select"
            value={data.selected_program_key || ''}
            onChange={event => setProgramKey(event.target.value)}
          >
            {data.available_programs.map(programme => (
              <option key={programme.program_key} value={programme.program_key}>{programme.name}</option>
            ))}
          </Form.Control>
        </Form.Group>
      )}
      <DashboardHero trainee={data.trainee} programme={data.programme} />
      <DashboardStats summary={data.summary} />
      <UpcomingSessionsCard sessions={data.upcoming_sessions} programKey={data.selected_program_key} />
      <CoursesSection courses={data.courses} />
      <ProgressCard courses={data.courses} summary={data.summary} results={data.results} />
      <Row className="trainee-dashboard__lower-grid">
        <Col xs={12} lg={7} className="mb-3"><AttendanceCard attendance={data.attendance} /></Col>
        <Col xs={12} lg={5}>
          <div className="trainee-dashboard__side-column">
            <FeedbackCard feedback={data.feedback} pendingCount={data.summary.pending_feedback} />
            <HolidaysCard holidays={data.holidays} />
          </div>
        </Col>
      </Row>
      <CertificatesSection certificates={data.certificates} programme={data.programme} />
    </DashboardShell>
  );
};

TraineeDashboardPage.propTypes = {
  profileSwitcher: PropTypes.node,
};

export default TraineeDashboardPage;
