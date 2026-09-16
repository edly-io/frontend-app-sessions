import React, { useState } from 'react';
import {
  Alert, Button, Card, Col, Icon, Row, Spinner,
} from '@openedx/paragon';
import {
  CheckCircle, EventNote, Feedback, School,
} from '@openedx/paragon/icons';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { Link } from 'react-router-dom';
import AttendanceToMarkCard from '../instructor-dashboard/components/AttendanceToMarkCard';
import FeedbackToSubmitCard from '../instructor-dashboard/components/FeedbackToSubmitCard';
import FeedbackFormModal from '../dashboard/FeedbackFormModal';
import useFeedback from '../dashboard/useFeedback';
import HolidaysCard from '../instructor-dashboard/components/HolidaysCard';
import PendingRequestsCard from './components/PendingRequestsCard';
import useAdminDashboard from './useAdminDashboard';
import './admin-dashboard.scss';
import '../dashboard/dashboard.scss';

const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

const AdminDashboardView = () => {
  const [feedbackRequestId, setFeedbackRequestId] = useState(null);
  const {
    data, isLoading, isError, error, refetch,
  } = useAdminDashboard();
  const feedbackForm = useFeedback(feedbackRequestId);

  if (isLoading) {
    return (
      <div className="py-5 text-center">
        <Spinner animation="border" screenReaderText="Loading dashboard" />
      </div>
    );
  }

  if (isError) {
    const detail = error?.response?.data?.error?.detail || error?.response?.data?.detail;
    return (
      <Alert variant="danger">
        <Alert.Heading>Could not load dashboard</Alert.Heading>
        {detail && <p>{detail}</p>}
        <Button variant="outline-primary" onClick={() => refetch()}>Try again</Button>
      </Alert>
    );
  }

  if (!data) { return null; }

  const s = data.summary ?? {};
  const displayName = data.admin?.full_name
    || getAuthenticatedUser()?.name
    || getAuthenticatedUser()?.username
    || 'Admin';
  const pendingCount = s.pending_feedback ?? 0;
  const totalRequests = (s.pending_leave_requests ?? 0)
    + (s.pending_remote_requests ?? 0)
    + (s.pending_substitute_requests ?? 0);
  const upcomingCount = data.upcoming_sessions?.length ?? 0;
  const attendanceCount = s.pending_attendance_sessions ?? 0;

  const formatSessionDate = (iso) => new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const statCards = [
    {
      icon: CheckCircle,
      value: attendanceCount,
      label: 'Sessions to mark',
      variant: '',
      scrollId: 'admin-attendance-section',
      showArrow: attendanceCount > 0,
    },
    {
      icon: EventNote,
      value: totalRequests,
      label: 'Pending requests',
      variant: '--warning',
      scrollId: 'admin-requests-section',
      showArrow: totalRequests > 0,
    },
    {
      icon: Feedback,
      value: pendingCount,
      label: 'Feedback to submit',
      variant: pendingCount > 0 ? '--feedback' : '',
      scrollId: 'admin-feedback-section',
      showArrow: pendingCount > 0,
    },
    {
      icon: School,
      value: upcomingCount,
      label: 'Upcoming sessions',
      variant: '--violet',
      scrollId: 'admin-upcoming-section',
      showArrow: false,
    },
  ];

  return (
    <div className="admin-dashboard">
      <section className="admin-dashboard__hero" aria-labelledby="admin-dashboard-heading">
        <div className="admin-dashboard__hero-copy">
          <h1 id="admin-dashboard-heading">Assalam-o-Alaikum, {displayName}</h1>
          <p>Here&apos;s your administrative overview for today.</p>
        </div>
        <div className="admin-dashboard__hero-meta">
          {data.admin?.role && (
            <span className="admin-dashboard__hero-badge">{data.admin.role}</span>
          )}
          {data.admin?.city && (
            <span className="admin-dashboard__hero-badge">{data.admin.city}</span>
          )}
        </div>
      </section>

      <Row className="admin-dashboard__stats mb-3">
        {statCards.map(stat => (
          <Col xs={6} lg={3} className="mb-3" key={stat.label}>
            <Card
              className={stat.showArrow ? 'dashboard-stat-card--clickable' : undefined}
              onClick={stat.showArrow ? () => scrollTo(stat.scrollId) : undefined}
            >
              <Card.Section className="admin-dashboard__stat-card">
                <span className={`admin-dashboard__stat-icon${stat.variant ? ` admin-dashboard__stat-icon${stat.variant}` : ''}`}>
                  <Icon src={stat.icon} />
                </span>
                <div>
                  <strong className="admin-dashboard__stat-value">{stat.value}</strong>
                  <span className="admin-dashboard__stat-label">{stat.label}</span>
                  <span className={`dashboard-stat-scroll-arrow${stat.showArrow ? '' : ' dashboard-stat-scroll-arrow--hidden'}`} aria-hidden="true">↓ View below</span>
                </div>
              </Card.Section>
            </Card>
          </Col>
        ))}
      </Row>

      <Row className="mb-3">
        <Col xs={12} lg={6} className="mb-3" id="admin-attendance-section">
          <AttendanceToMarkCard
            sessions={data.pending_attendance ?? []}
            getSessionLink={sess => `/${sess.program_key}/attendance/sessions/${sess.session_id}${sess.course_id ? `?course_id=${encodeURIComponent(sess.course_id)}` : ''}`}
          />
        </Col>
        <Col xs={12} lg={6} className="mb-3" id="admin-requests-section">
          <PendingRequestsCard requests={data.pending_requests} />
        </Col>
      </Row>

      <section className="admin-dashboard__section" id="admin-upcoming-section">
        <Card>
          <Card.Header
            title={<h2>Upcoming Sessions</h2>}
            subtitle="Next scheduled sessions across your programmes"
          />
          <Card.Section>
            {upcomingCount === 0 ? (
              <Alert variant="success">No sessions scheduled in the near future.</Alert>
            ) : (
              <div className="admin-dashboard__session-list">
                {data.upcoming_sessions.map(session => (
                  <article className="admin-dashboard__session-row" key={session.session_id}>
                    <div>
                      <strong>{session.title}</strong>
                      <p>
                        {[session.program_name, session.course_code, formatSessionDate(session.session_start)]
                          .filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Link
                      to={`/${session.program_key}/attendance${session.session_id ? `/sessions/${session.session_id}${session.course_id ? `?course_id=${encodeURIComponent(session.course_id)}` : ''}` : ''}`}
                      className="btn btn-outline-secondary btn-sm"
                    >
                      View →
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </Card.Section>
        </Card>
      </section>

      <Row className="mb-3">
        <Col xs={12} lg={7} className="mb-3" id="admin-feedback-section">
          <FeedbackToSubmitCard
            feedback={data.feedback ?? []}
            pendingCount={pendingCount}
            onOpenFeedback={setFeedbackRequestId}
          />
        </Col>
        <Col xs={12} lg={5}>
          <HolidaysCard holidays={data.holidays ?? []} />
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
    </div>
  );
};

export default AdminDashboardView;
