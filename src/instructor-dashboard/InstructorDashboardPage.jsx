import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Col, Row, Spinner,
} from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import DashboardShell from '../dashboard/DashboardShell';
import AttendanceToMarkCard from './components/AttendanceToMarkCard';
import DeliverySummaryCard from './components/DeliverySummaryCard';
import FeedbackToSubmitCard from './components/FeedbackToSubmitCard';
import FeedbackFormModal from './components/FeedbackFormModal';
import HolidaysCard from './components/HolidaysCard';
import InstructorCoursesSection from './components/InstructorCoursesSection';
import InstructorHero from './components/InstructorHero';
import InstructorStats from './components/InstructorStats';
import UpcomingSessionsCard from './components/UpcomingSessionsCard';
import messages from './messages';
import useInstructorDashboard from './useInstructorDashboard';
import useInstructorFeedback from './useInstructorFeedback';
import './instructor-dashboard.scss';

const InstructorDashboardPage = ({ profileSwitcher = null }) => {
  const intl = useIntl();
  const [feedbackRequestId, setFeedbackRequestId] = useState(null);
  const {
    data, isLoading, isError, error, refetch,
  } = useInstructorDashboard();
  const feedbackForm = useInstructorFeedback(feedbackRequestId);

  if (isLoading) {
    return (
      <DashboardShell className="instructor-dashboard" profileSwitcher={profileSwitcher}>
        <div className="py-5 text-center">
          <Spinner animation="border" screenReaderText={intl.formatMessage(messages.loading)} />
        </div>
      </DashboardShell>
    );
  }

  if (isError || !data) {
    const detail = error?.response?.data?.error?.detail || error?.response?.data?.detail;
    return (
      <DashboardShell className="instructor-dashboard" profileSwitcher={profileSwitcher}>
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

  return (
    <DashboardShell className="instructor-dashboard" profileSwitcher={profileSwitcher}>
      {data.state === 'no_assignments' && (
        <Alert variant="info">
          <Alert.Heading>{intl.formatMessage(messages.noAssignmentsTitle)}</Alert.Heading>
          {intl.formatMessage(messages.noAssignmentsBody)}
        </Alert>
      )}
      <InstructorHero instructor={data.instructor} week={data.week} />
      <InstructorStats summary={data.summary} />
      <UpcomingSessionsCard sessions={data.upcoming_sessions} timezone={data.timezone} />
      <InstructorCoursesSection courses={data.courses} />
      <DeliverySummaryCard delivery={data.delivery} courses={data.courses} timezone={data.timezone} />
      <Row className="instructor-dashboard__lower-grid">
        <Col xs={12} lg={7} className="mb-3">
          <FeedbackToSubmitCard
            feedback={data.feedback}
            pendingCount={data.summary.pending_feedback}
            onOpenFeedback={setFeedbackRequestId}
          />
        </Col>
        <Col xs={12} lg={5}>
          <div className="instructor-dashboard__side-column">
            <AttendanceToMarkCard sessions={data.attendance_to_mark} />
            <HolidaysCard holidays={data.holidays} />
          </div>
        </Col>
      </Row>
      <FeedbackFormModal
        isOpen={feedbackRequestId !== null}
        feedback={feedbackForm.feedback || null}
        isLoading={feedbackForm.isLoading}
        loadError={feedbackForm.loadError}
        onClose={() => setFeedbackRequestId(null)}
        onSubmit={feedbackForm.submit}
      />
    </DashboardShell>
  );
};

InstructorDashboardPage.propTypes = {
  profileSwitcher: PropTypes.node,
};

export default InstructorDashboardPage;
