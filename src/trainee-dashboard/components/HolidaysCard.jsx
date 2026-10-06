import React from 'react';
import PropTypes from 'prop-types';
import { Button, Card } from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import useExpandableList from '../../dashboard/useExpandableList';
import messages from '../messages';
import { formatDate, formatTime, getDateTile } from '../utils';

const HolidaysCard = ({ holidays }) => {
  const intl = useIntl();
  const {
    canExpand, isExpanded, toggleExpanded, visibleItems,
  } = useExpandableList(holidays);

  return (
    <section aria-labelledby="holidays-heading">
      <Card>
        <Card.Header
          title={<h2 id="holidays-heading">{intl.formatMessage(messages.holidays)}</h2>}
        />
        <Card.Section className="trainee-dashboard__compact-list dashboard-scroll-list" tabIndex={0} role="group" aria-labelledby="holidays-heading">
          {holidays.length === 0 && <p>{intl.formatMessage(messages.noHolidays)}</p>}
          {visibleItems.map(holiday => {
            const date = getDateTile(intl, holiday.start_date);
            const isRange = holiday.end_date && holiday.end_date !== holiday.start_date;
            const sessions = holiday.sessions || [];
            return (
              <article className="trainee-dashboard__holiday-row" key={holiday.id}>
                <time className="trainee-dashboard__holiday-date" dateTime={holiday.start_date}>
                  <strong>{date.day}</strong><span>{date.month}</span>
                </time>
                <div>
                  <h3>{holiday.name}</h3>
                  {isRange && (
                    <p>{intl.formatMessage(messages.holidayRange, {
                      start: formatDate(intl, holiday.start_date),
                      end: formatDate(intl, holiday.end_date),
                    })}
                    </p>
                  )}
                  {holiday.description && <p>{holiday.description}</p>}
                  {sessions.length > 0 ? (
                    <ul className="trainee-dashboard__holiday-sessions">
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
                    <p className="trainee-dashboard__holiday-no-sessions">
                      {intl.formatMessage(messages.noSessions)}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </Card.Section>
        {canExpand && (
          <Card.Section className="dashboard-list-footer">
            <Button variant="link" size="sm" onClick={toggleExpanded}>
              {intl.formatMessage(isExpanded ? messages.showLess : messages.viewAll)}
            </Button>
          </Card.Section>
        )}
      </Card>
    </section>
  );
};

HolidaysCard.propTypes = {
  holidays: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    start_date: PropTypes.string.isRequired,
    end_date: PropTypes.string.isRequired,
    no_sessions: PropTypes.bool.isRequired,
    sessions: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      course_code: PropTypes.string,
      scheduled_start: PropTypes.string.isRequired,
    })),
  })).isRequired,
};

export default HolidaysCard;
