import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Icon } from '@openedx/paragon';
import { LocationOn, Person, School } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';

const InstructorHero = ({ instructor, week }) => {
  const intl = useIntl();
  const instructorName = instructor.first_name || instructor.full_name;
  const organization = [instructor.designation, instructor.department].filter(Boolean).join(' · ');

  return (
    <section className="instructor-dashboard__hero" aria-labelledby="instructor-dashboard-heading">
      <div className="instructor-dashboard__hero-copy">
        <h1 id="instructor-dashboard-heading">
          {intl.formatMessage(messages.greeting, { name: instructorName })}
        </h1>
        <p>{intl.formatMessage(messages.weekSummary, { count: week.sessions })}</p>
        <div className="instructor-dashboard__identity" aria-label={intl.formatMessage(messages.instructorDetails)}>
          {organization && <Badge variant="light"><Icon src={School} />{organization}</Badge>}
          {instructor.employee_id && (
            <Badge variant="light">
              <Icon src={Person} />
              {intl.formatMessage(messages.employeeId, { id: instructor.employee_id })}
            </Badge>
          )}
          {instructor.campus?.name && (
            <Badge variant="light"><Icon src={LocationOn} />{instructor.campus.name}</Badge>
          )}
        </div>
      </div>
      <dl className="instructor-dashboard__week-stats">
        <div>
          <dt>{intl.formatMessage(messages.sessionsThisWeek)}</dt>
          <dd>{week.sessions}</dd>
        </div>
        <div>
          <dt>{intl.formatMessage(messages.scheduledHours)}</dt>
          <dd>{intl.formatMessage(messages.hoursShort, { hours: week.scheduled_hours })}</dd>
        </div>
      </dl>
    </section>
  );
};

InstructorHero.propTypes = {
  instructor: PropTypes.shape({
    first_name: PropTypes.string,
    full_name: PropTypes.string.isRequired,
    designation: PropTypes.string,
    department: PropTypes.string,
    employee_id: PropTypes.string,
    campus: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      name: PropTypes.string.isRequired,
    }),
  }).isRequired,
  week: PropTypes.shape({
    sessions: PropTypes.number.isRequired,
    scheduled_hours: PropTypes.number.isRequired,
  }).isRequired,
};

export default InstructorHero;
