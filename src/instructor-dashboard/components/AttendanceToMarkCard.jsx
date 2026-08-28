import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Card, Icon,
} from '@openedx/paragon';
import { CheckCircle, FactCheck } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';
import { formatDate } from '../utils';

const AttendanceToMarkCard = ({ sessions }) => {
  const intl = useIntl();
  const getAgeLabel = (ageDays) => {
    if (ageDays === 0) { return intl.formatMessage(messages.today); }
    if (ageDays === 1) { return intl.formatMessage(messages.yesterday); }
    return intl.formatMessage(messages.daysAgo, { count: ageDays });
  };

  return (
    <Card>
      <Card.Header
        title={<h2 id="instructor-attendance-heading">{intl.formatMessage(messages.attendanceToMark)}</h2>}
        subtitle={intl.formatMessage(messages.waitingCount, { count: sessions.length })}
      />
      <Card.Section>
        {!sessions.length ? (
          <Alert variant="success" icon={CheckCircle}>
            <Alert.Heading>{intl.formatMessage(messages.allAttendanceRecorded)}</Alert.Heading>
            {intl.formatMessage(messages.nothingWaiting)}
          </Alert>
        ) : (
          <div className="instructor-dashboard__compact-list">
            {sessions.map(session => (
              <article className="instructor-dashboard__attendance-row" key={session.session_id}>
                <span className="instructor-dashboard__list-icon"><Icon src={FactCheck} /></span>
                <div>
                  <strong>{session.title}</strong>
                  <p>
                    {[session.course_code, intl.formatMessage(messages.trainees, { count: session.trainee_count })]
                      .filter(Boolean).join(' · ')}
                  </p>
                  <small>
                    <time dateTime={session.session_start}>{formatDate(intl, session.session_start)}</time> · {' '}
                    {getAgeLabel(session.age_days)}
                  </small>
                </div>
                <Badge variant="warning">
                  {intl.formatMessage(messages.unmarkedCount, { count: session.unmarked_count })}
                </Badge>
              </article>
            ))}
          </div>
        )}
      </Card.Section>
    </Card>
  );
};

AttendanceToMarkCard.propTypes = {
  sessions: PropTypes.arrayOf(PropTypes.shape({
    session_id: PropTypes.string.isRequired,
    program_key: PropTypes.string.isRequired,
    course_id: PropTypes.string,
    session_start: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    course_code: PropTypes.string,
    trainee_count: PropTypes.number.isRequired,
    unmarked_count: PropTypes.number.isRequired,
    age_days: PropTypes.number.isRequired,
    can_mark: PropTypes.bool.isRequired,
  })).isRequired,
};

export default AttendanceToMarkCard;
