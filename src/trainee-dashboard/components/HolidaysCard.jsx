import React from 'react';
import PropTypes from 'prop-types';
import { Card } from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';
import { formatDate, getDateTile } from '../utils';

const HolidaysCard = ({ holidays }) => {
  const intl = useIntl();

  return (
    <section aria-labelledby="holidays-heading">
      <Card>
        <Card.Header
          title={<h2 id="holidays-heading">{intl.formatMessage(messages.holidays)}</h2>}
          subtitle={intl.formatMessage(messages.noSessions)}
        />
        <Card.Section className="trainee-dashboard__compact-list">
          {holidays.length === 0 && <p>{intl.formatMessage(messages.noHolidays)}</p>}
          {holidays.map(holiday => {
            const date = getDateTile(intl, holiday.start_date);
            const isRange = holiday.end_date && holiday.end_date !== holiday.start_date;
            const description = holiday.description || (holiday.no_sessions
              ? intl.formatMessage(messages.campusClosed) : '');
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
                  {description && <p>{description}</p>}
                </div>
              </article>
            );
          })}
        </Card.Section>
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
  })).isRequired,
};

export default HolidaysCard;
