import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, Icon,
} from '@openedx/paragon';
import {
  AccessTime, LocationOn, People, Videocam,
} from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';
import { formatDate, formatTime, parseDashboardDate } from '../utils';

const MODE_MESSAGES = {
  online: messages.online,
  on_site: messages.onSite,
  hybrid: messages.hybrid,
};

const formatDuration = (intl, durationMinutes) => {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (!hours) { return intl.formatMessage(messages.minutes, { minutes }); }
  if (!minutes) { return intl.formatMessage(messages.hours, { hours }); }
  return intl.formatMessage(messages.hoursMinutes, { hours, minutes });
};

const ModeBadge = ({ mode }) => {
  const intl = useIntl();
  return (
    <Badge variant={mode === 'online' ? 'success' : 'info'}>
      {mode === 'online' && <Icon src={Videocam} />}
      {intl.formatMessage(MODE_MESSAGES[mode])}
    </Badge>
  );
};

ModeBadge.propTypes = {
  mode: PropTypes.oneOf(['online', 'on_site', 'hybrid']).isRequired,
};

const UpcomingSessionsCard = ({ sessions, timezone = undefined }) => {
  const intl = useIntl();
  const [nextSession, ...laterSessions] = sessions;

  const renderDate = value => (
    <time dateTime={value} className="instructor-dashboard__session-date">
      <strong>{intl.formatDate(parseDashboardDate(value), { day: 'numeric', timeZone: timezone })}</strong>
      <span>{intl.formatDate(parseDashboardDate(value), { month: 'short', timeZone: timezone })}</span>
    </time>
  );

  return (
    <section className="instructor-dashboard__section" aria-labelledby="instructor-upcoming-heading">
      <Card>
        <Card.Header
          title={<h2 id="instructor-upcoming-heading">{intl.formatMessage(messages.upcomingSessions)}</h2>}
          subtitle={intl.formatMessage(messages.upcomingSessionsSubtitle)}
        />
        <Card.Section>
          {!nextSession ? <Alert variant="info">{intl.formatMessage(messages.noUpcomingSessions)}</Alert> : (
            <>
              <article className="instructor-dashboard__next-session">
                {renderDate(nextSession.scheduled_start)}
                <div className="instructor-dashboard__session-copy">
                  <div className="instructor-dashboard__badges">
                    <Badge variant="warning">
                      {formatDate(intl, nextSession.scheduled_start, { weekday: 'long' }, timezone)} · {' '}
                      {formatTime(intl, nextSession.scheduled_start, timezone)}
                    </Badge>
                    <ModeBadge mode={nextSession.mode} />
                    {nextSession.course_code && <Badge variant="info">{nextSession.course_code}</Badge>}
                  </div>
                  <h3>{nextSession.title}</h3>
                  <div className="instructor-dashboard__session-meta">
                    <span>
                      <Icon src={People} />
                      {intl.formatMessage(messages.trainees, { count: nextSession.trainee_count })}
                    </span>
                    <span><Icon src={AccessTime} />{formatDuration(intl, nextSession.duration_minutes)}</span>
                    <span>
                      <Icon src={LocationOn} />
                      {nextSession.location?.name || intl.formatMessage(messages.locationUnavailable)}
                    </span>
                  </div>
                </div>
                <div className="instructor-dashboard__session-actions">
                  <Button
                    as={nextSession.can_view_details ? Link : undefined}
                    to={nextSession.can_view_details
                      ? `/${nextSession.program_key}/calendar?modal=session&id=${encodeURIComponent(nextSession.id)}`
                      : undefined}
                    disabled={!nextSession.can_view_details}
                    title={!nextSession.can_view_details
                      ? intl.formatMessage(messages.detailsUnavailable)
                      : undefined}
                  >
                    {intl.formatMessage(messages.viewDetails)}
                  </Button>
                </div>
              </article>
              <div>
                {laterSessions.map(session => (
                  <article className="instructor-dashboard__session-row" key={session.id}>
                    {renderDate(session.scheduled_start)}
                    <div className="instructor-dashboard__session-copy">
                      <h3>{session.title}</h3>
                      <p>
                        {session.course_code && <>{session.course_code} · {' '}</>}
                        {intl.formatMessage(messages.trainees, { count: session.trainee_count })} · {' '}
                        {session.location?.name || intl.formatMessage(messages.locationUnavailable)}
                      </p>
                    </div>
                    <div className="instructor-dashboard__session-time">
                      <strong>
                        {formatTime(intl, session.scheduled_start, timezone)} · {' '}
                        {formatDuration(intl, session.duration_minutes)}
                      </strong>
                      <ModeBadge mode={session.mode} />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </Card.Section>
      </Card>
    </section>
  );
};

const sessionShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  program_key: PropTypes.string.isRequired,
  scheduled_start: PropTypes.string.isRequired,
  duration_minutes: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  course_code: PropTypes.string,
  trainee_count: PropTypes.number.isRequired,
  mode: PropTypes.oneOf(['online', 'on_site', 'hybrid']).isRequired,
  location: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    name: PropTypes.string.isRequired,
  }),
  can_view_details: PropTypes.bool.isRequired,
});

UpcomingSessionsCard.propTypes = {
  sessions: PropTypes.arrayOf(sessionShape).isRequired,
  timezone: PropTypes.string,
};

export default UpcomingSessionsCard;
