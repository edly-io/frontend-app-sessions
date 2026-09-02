import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Badge, Card } from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import messages from '../messages';
import { formatDate, formatTime } from '../utils';

const formatDuration = (intl, durationMinutes) => {
  const hours = durationMinutes / 60;
  return intl.formatMessage(messages.hours, { hours: Number.isInteger(hours) ? hours : hours.toFixed(1) });
};

const DeliverySummaryCard = ({ courses, delivery, timezone = undefined }) => {
  const intl = useIntl();
  const averageMinutes = delivery.delivered_sessions
    ? Math.round((delivery.delivered_hours * 60) / delivery.delivered_sessions)
    : 0;
  const maxWeek = Math.max(...delivery.weekly_hours.map(week => week.hours), 1);
  const maxCourseHours = Math.max(...courses.map(course => course.delivered_hours), 1);
  const monthlyChange = delivery.change_from_last_month_hours;

  const getMonthlyChange = () => {
    if (monthlyChange > 0) {
      return {
        message: messages.increaseFromLastMonth,
        values: { hours: monthlyChange },
        variant: 'success',
      };
    }
    if (monthlyChange < 0) {
      return {
        message: messages.decreaseFromLastMonth,
        values: { hours: Math.abs(monthlyChange) },
        variant: 'danger',
      };
    }
    return { message: messages.noChangeFromLastMonth, values: {}, variant: 'light' };
  };
  const change = getMonthlyChange();

  return (
    <section className="instructor-dashboard__section" aria-labelledby="delivery-summary-heading">
      <Card>
        <Card.Header
          title={<h2 id="delivery-summary-heading">{intl.formatMessage(messages.deliverySummary)}</h2>}
          subtitle={intl.formatMessage(messages.deliverySubtitle)}
        />
        <Card.Section>
          <div className="instructor-dashboard__delivery-grid">
            <div>
              <div className="instructor-dashboard__delivery-total">
                <strong>{intl.formatMessage(messages.hoursShort, { hours: delivery.delivered_hours })}</strong>
                <span>{intl.formatMessage(messages.deliveryHeadline, { sessions: delivery.delivered_sessions })}</span>
                <Badge variant={change.variant}>
                  {intl.formatMessage(change.message, change.values)}
                </Badge>
              </div>
              <h3 className="instructor-dashboard__subheading">{intl.formatMessage(messages.weeklyHours)}</h3>
              <ol className="instructor-dashboard__weekly-chart">
                {delivery.weekly_hours.map((week, index) => (
                  <li key={week.week_start}>
                    <span
                      className="instructor-dashboard__weekly-bar"
                      // eslint-disable-next-line react/forbid-component-props
                      style={{ height: `${Math.max(12, Math.round((week.hours / maxWeek) * 100))}%` }}
                      aria-hidden="true"
                    />
                    <span className="sr-only">
                      {intl.formatMessage(messages.teachingHoursWeek, { week: index + 1, hours: week.hours })}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3>{intl.formatMessage(messages.atAGlance)}</h3>
              <dl className="instructor-dashboard__glance-grid">
                <div>
                  <dt>{intl.formatMessage(messages.averageSessionLength)}</dt>
                  <dd>{formatDuration(intl, averageMinutes)}</dd>
                </div>
                <div>
                  <dt>{intl.formatMessage(messages.sessionsThisMonth)}</dt>
                  <dd>{delivery.this_month_sessions}</dd>
                </div>
                <div>
                  <dt>{intl.formatMessage(messages.averageAttendance)}</dt>
                  <dd>{delivery.average_attendance_percentage}%</dd>
                </div>
                <div>
                  <dt>{intl.formatMessage(messages.rescheduledSessions)}</dt>
                  <dd>{delivery.rescheduled_sessions}</dd>
                </div>
              </dl>
            </div>
          </div>
          <h3 className="instructor-dashboard__subheading">{intl.formatMessage(messages.hoursByCourse)}</h3>
          <div className="instructor-dashboard__course-hours">
            {courses.map(course => (
              <div className="instructor-dashboard__course-hours-row" key={course.course_id}>
                <span>{course.name}</span>
                <span className="instructor-dashboard__course-hours-track" aria-hidden="true">
                  <span
                    // eslint-disable-next-line react/forbid-component-props
                    style={{ width: `${Math.round((course.delivered_hours / maxCourseHours) * 100)}%` }}
                  />
                </span>
                <strong aria-label={intl.formatMessage(messages.courseHours, {
                  course: course.name,
                  hours: course.delivered_hours,
                })}
                >
                  {intl.formatMessage(messages.hoursShort, { hours: course.delivered_hours })}
                </strong>
              </div>
            ))}
          </div>
          <h3 className="instructor-dashboard__subheading">{intl.formatMessage(messages.recentSessions)}</h3>
          {!delivery.recent_sessions.length ? (
            <Alert variant="info">{intl.formatMessage(messages.noDeliveryHistory)}</Alert>
          ) : delivery.recent_sessions.map(session => (
            <article className="instructor-dashboard__recent-session" key={session.id}>
              <time dateTime={session.scheduled_start}>
                {formatDate(intl, session.scheduled_start, {}, timezone)} · {' '}
                {formatTime(intl, session.scheduled_start, timezone)}
              </time>
              <div><strong>{session.title}</strong>{session.course_code && <span>{session.course_code}</span>}</div>
              <span>{formatDuration(intl, session.duration_minutes)}</span>
              <span>
                {intl.formatMessage(messages.presentCount, {
                  present: session.present,
                  total: session.trainee_count,
                })}
              </span>
            </article>
          ))}
        </Card.Section>
      </Card>
    </section>
  );
};

DeliverySummaryCard.propTypes = {
  courses: PropTypes.arrayOf(PropTypes.shape({
    course_id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    delivered_hours: PropTypes.number.isRequired,
  })).isRequired,
  delivery: PropTypes.shape({
    delivered_hours: PropTypes.number.isRequired,
    delivered_sessions: PropTypes.number.isRequired,
    change_from_last_month_hours: PropTypes.number.isRequired,
    weekly_hours: PropTypes.arrayOf(PropTypes.shape({
      week_start: PropTypes.string.isRequired,
      week_end: PropTypes.string.isRequired,
      hours: PropTypes.number.isRequired,
    })).isRequired,
    this_month_sessions: PropTypes.number.isRequired,
    average_attendance_percentage: PropTypes.number.isRequired,
    rescheduled_sessions: PropTypes.number.isRequired,
    recent_sessions: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string.isRequired,
      scheduled_start: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      course_code: PropTypes.string,
      duration_minutes: PropTypes.number.isRequired,
      present: PropTypes.number.isRequired,
      trainee_count: PropTypes.number.isRequired,
    })).isRequired,
  }).isRequired,
  timezone: PropTypes.string,
};

export default DeliverySummaryCard;
