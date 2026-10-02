import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Button, Card } from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import useExpandableList from '../../dashboard/useExpandableList';
import messages from '../messages';
import { formatDate, parseDashboardDate } from '../utils';

const HolidaysCard = ({ holidays }) => {
  const intl = useIntl();
  const {
    canExpand, isExpanded, toggleExpanded, visibleItems,
  } = useExpandableList(holidays);

  return (
    <Card>
      <Card.Header
        title={<h2 id="instructor-holidays-heading">{intl.formatMessage(messages.upcomingHolidays)}</h2>}
        subtitle={intl.formatMessage(messages.noSessionsScheduled)}
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
  })).isRequired,
};

export default HolidaysCard;
