import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Card } from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import useExpandableList from '../../dashboard/useExpandableList';
import messages from '../messages';
import { formatDate, formatTime, parseDashboardDate } from '../utils';

const HolidaysCard = ({ holidays }) => {
  const intl = useIntl();
  const {
    canExpand, isExpanded, toggleExpanded, visibleItems,
  } = useExpandableList(holidays);

  return (
    <Card>
      <Card.Header
        title={<h2 id="instructor-holidays-heading">{intl.formatMessage(messages.upcomingHolidays)}</h2>}
      />
      <Card.Section tabIndex={0} role="group" aria-labelledby="instructor-holidays-heading">
        {!holidays.length ? <Alert variant="info">{intl.formatMessage(messages.noHolidays)}</Alert> : (
          <div className="instructor-dashboard__compact-list dashboard-scroll-list">
            {visibleItems.map(holiday => {
              const date = parseDashboardDate(holiday.start_date);
              const isMultiDay = holiday.start_date !== holiday.end_date;
              const dateDescription = isMultiDay
                ? intl.formatMessage(messages.holidayDateRange, {
                  startDate: formatDate(intl, holiday.start_date),
                  endDate: formatDate(intl, holiday.end_date),
                })
                : formatDate(intl, holiday.start_date, { weekday: 'long' });
              const sessions = holiday.sessions || [];
              return (
                <article className="instructor-dashboard__holiday-row" key={holiday.id}>
                  <time dateTime={holiday.start_date} className="instructor-dashboard__holiday-date">
                    <strong>{date ? intl.formatDate(date, { day: 'numeric' }) : ''}</strong>
                    <span>{date ? intl.formatDate(date, { month: 'short' }) : ''}</span>
                  </time>
                  <div>
                    <strong>{holiday.name}</strong>
                    <p>
                      {dateDescription}
                      {holiday.description && ` · ${holiday.description}`}
                    </p>
                    {sessions.length > 0 ? (
                      <ul className="instructor-dashboard__holiday-sessions">
                        {sessions.map(session => (
                          <li key={session.id}>
                            <strong>{formatTime(intl, session.scheduled_start)}</strong>
                            {' · '}
                            {session.title}
                            {session.course_code && ` (${session.course_code})`}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="instructor-dashboard__holiday-no-sessions">
                        {intl.formatMessage(messages.noSessionsScheduled)}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card.Section>
      {canExpand && (
        <Card.Section className="dashboard-list-footer">
          <Button variant="link" size="sm" onClick={toggleExpanded}>
            {intl.formatMessage(isExpanded ? messages.showLess : messages.viewAll)}
          </Button>
        </Card.Section>
      )}
    </Card>
  );
};

HolidaysCard.propTypes = {
  holidays: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    start_date: PropTypes.string.isRequired,
    end_date: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    no_sessions: PropTypes.bool.isRequired,
    campus_ids: PropTypes.arrayOf(PropTypes.number),
    sessions: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      course_code: PropTypes.string,
      scheduled_start: PropTypes.string.isRequired,
    })),
  })).isRequired,
};

export default HolidaysCard;
