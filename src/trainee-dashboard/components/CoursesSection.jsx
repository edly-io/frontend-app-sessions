import React from 'react';
import {
  Badge, Card, Col, Row,
} from '@openedx/paragon';
import { useIntl } from '@edx/frontend-platform/i18n';
import { courses } from '../dashboardData';
import messages from '../messages';
import AccessibleProgressBar from './AccessibleProgressBar';

const CoursesSection = () => {
  const intl = useIntl();

  return (
    <section aria-labelledby="courses-heading" className="trainee-dashboard__section">
      <div className="trainee-dashboard__section-heading">
        <h2 id="courses-heading">{intl.formatMessage(messages.myCourses)}</h2>
        <span>{intl.formatMessage(messages.programmeCourses)}</span>
      </div>
      <Row>
        {courses.map(course => {
          const percentage = Math.round((course.completed / course.total) * 100);
          return (
            <Col xs={12} md={6} xl={4} key={course.code} className="mb-3">
              <Card className="trainee-dashboard__course-card h-100">
                <Card.Section>
                  <div className="trainee-dashboard__course-header">
                    <span className="trainee-dashboard__course-code">{course.code}</span>
                    <span className="trainee-dashboard__course-copy"><h3>{course.name}</h3><small>{course.instructor}</small></span>
                    <Badge variant={percentage === 100 ? 'success' : 'info'}>
                      {intl.formatMessage(percentage === 100 ? messages.completed : messages.inProgress)}
                    </Badge>
                  </div>
                  <AccessibleProgressBar
                    now={percentage}
                    variant={percentage === 100 ? 'success' : 'warning'}
                    label={intl.formatMessage(messages.progressLabel, { context: course.name, percentage })}
                  />
                  <div className="trainee-dashboard__course-progress">
                    <strong>{percentage}%</strong>
                    <span>{intl.formatMessage(messages.modules, {
                      completed: course.completed,
                      total: course.total,
                    })}
                    </span>
                  </div>
                </Card.Section>
              </Card>
            </Col>
          );
        })}
      </Row>
    </section>
  );
};

export default CoursesSection;
