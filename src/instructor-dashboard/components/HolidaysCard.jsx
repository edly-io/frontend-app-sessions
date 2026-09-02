import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Card } from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';
import { formatDate, parseDashboardDate } from '../utils';

const HolidaysCard = ({ holidays }) => {
  const intl = useIntl();

  return (
    <Card>
      <Card.Header
        title={<h2 id="instructor-holidays-heading">{intl.formatMessage(messages.upcomingHolidays)}</h2>}
        subtitle={intl.formatMessage(messages.noSessionsScheduled)}
      />
      <Card.Section>
        {!holidays.length ? <Alert variant="info">{intl.formatMessage(messages.noHolidays)}</Alert> : (
          <div className="instructor-dashboard__compact-list">
            {holidays.map(holiday => {
              const date = parseDashboardDate(holiday.start_date);
              return (
                <article className="instructor-dashboard__holiday-row" key={holiday.id}>
                  <time dateTime={holiday.start_date} className="instructor-dashboard__holiday-date">
                    <strong>{date ? intl.formatDate(date, { day: 'numeric' }) : ''}</strong>
                    <span>{date ? intl.formatDate(date, { month: 'short' }) : ''}</span>
                  </time>
                  <div>
                    <strong>{holiday.name}</strong>
                    <p>
                      {formatDate(intl, holiday.start_date, { weekday: 'long' })}
                      {holiday.description && ` · ${holiday.description}`}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card.Section>
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
  })).isRequired,
};

export default HolidaysCard;
