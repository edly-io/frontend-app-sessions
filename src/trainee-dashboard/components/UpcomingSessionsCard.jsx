import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import {
  Alert, Badge, Button, Card, Icon,
} from '@openedx/paragon';
import {
  AccessTime, LocationOn, Person, Videocam,
} from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';
import {
  formatTime, getDateTile, joinInstructorNames, parseApiDate,
} from '../utils';

const MODE_MESSAGES = {
  online: messages.online,
  on_site: messages.onSite,
  hybrid: messages.hybrid,
};

const formatDuration = (intl, minutes) => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (!hours) { return intl.formatMessage(messages.durationMinutes, { minutes }); }
  if (!remainingMinutes) { return intl.formatMessage(messages.durationHours, { hours }); }
  return intl.formatMessage(messages.durationHoursMinutes, { hours, minutes: remainingMinutes });
};

const formatStartsIn = (intl, value) => {
  const start = parseApiDate(value);
  if (!start) { return ''; }
  const minutes = Math.max(0, Math.round((start.getTime() - Date.now()) / 60000));
  if (minutes === 0) { return intl.formatMessage(messages.sessionStarted); }
  if (minutes < 60) { return intl.formatMessage(messages.startsInMinutes, { minutes }); }
  return intl.formatMessage(messages.startsInHours, {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
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

const SessionDate = ({ value, compact = false }) => {
  const intl = useIntl();
  const date = getDateTile(intl, value);
  return (
    <time className={compact ? 'trainee-dashboard__date-compact' : 'trainee-dashboard__date-tile'} dateTime={value}>
      <strong>{date.day}</strong><span>{date.month}</span>
    </time>
  );
};

SessionDate.propTypes = {
  value: PropTypes.string.isRequired,
  compact: PropTypes.bool,
};

const UpcomingSessionsCard = ({ sessions, programKey }) => {
  const intl = useIntl();
  const [nextSession, ...laterSessions] = sessions;

  return (
    <section aria-labelledby="upcoming-sessions-heading" className="trainee-dashboard__section">
      <Card>
        <Card.Header
          title={<h2 id="upcoming-sessions-heading">{intl.formatMessage(messages.upcomingSessions)}</h2>}
          subtitle={intl.formatMessage(messages.scheduledClasses)}
        />
        <Card.Section>
          {!nextSession ? <Alert variant="info">{intl.formatMessage(messages.noUpcomingSessions)}</Alert> : (
            <>
              <article className="trainee-dashboard__next-session">
                <SessionDate value={nextSession.scheduled_start} />
                <div className="trainee-dashboard__session-copy">
                  <div className="trainee-dashboard__badges">
                    <Badge variant="warning">{formatTime(intl, nextSession.scheduled_start)}</Badge>
                    <ModeBadge mode={nextSession.mode} />
                    <Badge variant="info">{nextSession.course_code}</Badge>
                  </div>
                  <h3>{nextSession.title}</h3>
                  <div className="trainee-dashboard__session-meta">
                    <span>
                      <Icon src={Person} />
                      {joinInstructorNames(nextSession.instructors)
                        || intl.formatMessage(messages.instructorUnavailable)}
                    </span>
                    <span>
                      <Icon src={AccessTime} />{formatDuration(intl, nextSession.duration_minutes)}
                    </span>
                    <span>
                      <Icon src={LocationOn} />
                      {nextSession.location?.name || intl.formatMessage(messages.locationUnavailable)}
                    </span>
                  </div>
                </div>
                <div className="trainee-dashboard__session-actions">
                  <strong>{formatStartsIn(intl, nextSession.scheduled_start)}</strong>
                  <Button
                    as={nextSession.can_view_details ? Link : undefined}
                    to={nextSession.can_view_details
                      ? `/${programKey}/calendar?modal=session&id=${encodeURIComponent(nextSession.id)}` : undefined}
                    disabled={!nextSession.can_view_details}
                    title={!nextSession.can_view_details ? intl.formatMessage(messages.detailsUnavailable) : undefined}
                  >
                    {intl.formatMessage(messages.viewDetails)}
                  </Button>
                </div>
              </article>
              <div className="trainee-dashboard__session-list">
                {laterSessions.map(session => (
                  <article className="trainee-dashboard__session-row" key={session.id}>
                    <SessionDate value={session.scheduled_start} compact />
                    <div>
                      <h3>{session.title}</h3>
                      <p>
                        {joinInstructorNames(session.instructors)
                          || intl.formatMessage(messages.instructorUnavailable)} · {session.course_code} ·{' '}
                        {session.location?.name || intl.formatMessage(messages.locationUnavailable)}
                      </p>
                    </div>
                    <div className="trainee-dashboard__session-time">
                      <strong>
                        {formatTime(intl, session.scheduled_start)} ·{' '}
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
  title: PropTypes.string.isRequired,
  course_code: PropTypes.string.isRequired,
  scheduled_start: PropTypes.string.isRequired,
  duration_minutes: PropTypes.number.isRequired,
  mode: PropTypes.oneOf(['online', 'on_site', 'hybrid']).isRequired,
  location: PropTypes.shape({ name: PropTypes.string.isRequired }),
  instructors: PropTypes.arrayOf(PropTypes.shape({ full_name: PropTypes.string.isRequired })).isRequired,
  can_view_details: PropTypes.bool.isRequired,
});

UpcomingSessionsCard.propTypes = {
  sessions: PropTypes.arrayOf(sessionShape).isRequired,
  programKey: PropTypes.string.isRequired,
};

export default UpcomingSessionsCard;
