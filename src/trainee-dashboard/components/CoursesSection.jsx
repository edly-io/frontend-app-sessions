import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Card, Col, Row,
} from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import AccessibleProgressBar from '../../dashboard/AccessibleProgressBar';
import messages from '../messages';
import { joinInstructorNames } from '../utils';

const STATUS_MESSAGES = {
  completed: messages.completed,
  in_progress: messages.inProgress,
  not_started: messages.notStarted,
  unavailable: messages.progressUnavailable,
};

const CoursesSection = ({ courses }) => {
  const intl = useIntl();

  return (
    <section aria-labelledby="courses-heading" className="trainee-dashboard__section">
      <div className="trainee-dashboard__section-heading">
        <h2 id="courses-heading">{intl.formatMessage(messages.myCourses)}</h2>
        <span>{intl.formatMessage(messages.programmeCourses)}</span>
      </div>
      {courses.length === 0 ? <Alert variant="info">{intl.formatMessage(messages.noCourses)}</Alert> : (
        <Row>
          {courses.map(course => {
            const unavailable = course.status === 'unavailable';
            const percentage = course.progress_percentage;
            return (
              <Col xs={12} md={6} xl={4} key={course.course_id} className="mb-3">
                <Card className="trainee-dashboard__course-card h-100">
                  <Card.Section>
                    <div className="trainee-dashboard__course-header">
                      <span className="trainee-dashboard__course-code">{course.course_code}</span>
                      <span className="trainee-dashboard__course-copy">
                        <h3>{course.name}</h3>
                        <small>
                          {joinInstructorNames(course.instructors)
                            || intl.formatMessage(messages.instructorUnavailable)}
                        </small>
                      </span>
                      <Badge variant={course.status === 'completed' ? 'success' : 'info'}>
                        {intl.formatMessage(STATUS_MESSAGES[course.status])}
                      </Badge>
                    </div>
                    {!unavailable && (
                      <AccessibleProgressBar
                        now={percentage}
                        variant={percentage === 100 ? 'success' : 'warning'}
                        label={intl.formatMessage(messages.progressLabel, { context: course.name, percentage })}
                      />
                    )}
                    <div className="trainee-dashboard__course-progress">
                      {!unavailable && <strong>{percentage}%</strong>}
                      <span>{unavailable
                        ? intl.formatMessage(messages.progressUnavailable)
                        : intl.formatMessage(messages.modules, {
                          completed: course.completed_modules,
                          total: course.total_modules,
                        })}
                      </span>
                    </div>
                  </Card.Section>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
    </section>
  );
};

CoursesSection.propTypes = {
  courses: PropTypes.arrayOf(PropTypes.shape({
    course_id: PropTypes.string.isRequired,
    course_code: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    instructors: PropTypes.arrayOf(PropTypes.shape({ full_name: PropTypes.string.isRequired })).isRequired,
    completed_modules: PropTypes.number.isRequired,
    total_modules: PropTypes.number.isRequired,
    progress_percentage: PropTypes.number.isRequired,
    status: PropTypes.oneOf(['not_started', 'in_progress', 'completed', 'unavailable']).isRequired,
  })).isRequired,
};

export default CoursesSection;
