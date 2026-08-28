import React from 'react';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import DeliverySummaryCard from './DeliverySummaryCard';
import InstructorCoursesSection from './InstructorCoursesSection';
import InstructorHero from './InstructorHero';
import UpcomingSessionsCard from './UpcomingSessionsCard';

const renderComponent = component => render(
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>{component}</IntlProvider>
  </MemoryRouter>,
);

it('renders nullable instructor and session metadata from the API contract', () => {
  renderComponent(
    <>
      <InstructorHero
        instructor={{
          first_name: 'Ayesha',
          full_name: 'Ayesha Khan',
          designation: null,
          department: null,
          employee_id: null,
          campus: null,
        }}
        week={{ sessions: 2, scheduled_hours: 3.5 }}
      />
      <UpcomingSessionsCard
        timezone="Asia/Karachi"
        sessions={[{
          id: 'session-1',
          program_key: 'program-v1:FBR+STP50+2026',
          scheduled_start: '2026-08-28T22:30:00+00:00',
          duration_minutes: 90,
          title: 'Tax workshop',
          course_code: null,
          trainee_count: 24,
          mode: 'on_site',
          location: null,
          can_view_details: true,
        }]}
      />
    </>,
  );

  expect(screen.getByRole('heading', { name: 'Assalam-o-Alaikum, Ayesha' })).toBeInTheDocument();
  expect(screen.getByText('3.5 hrs')).toBeInTheDocument();
  expect(screen.getByText('Location to be confirmed')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View details' })).toHaveAttribute(
    'href',
    '/program-v1:FBR+STP50+2026/calendar?modal=session&id=session-1',
  );
});

it('uses average course progress and represents unavailable progress without module counts', () => {
  renderComponent(
    <InstructorCoursesSection courses={[
      {
        course_id: 'course-v1:FBR+TX101+2026',
        program_key: 'program-v1:FBR+STP50+2026',
        course_code: 'TX-101',
        name: 'Income Tax Law',
        programme_name: null,
        campus: null,
        trainee_count: 32,
        average_progress_percentage: 63,
        delivered_hours: 12,
        status: 'in_progress',
        can_manage: true,
      },
      {
        course_id: 'course-v1:FBR+TX102+2026',
        program_key: 'program-v1:FBR+STP50+2026',
        course_code: null,
        name: 'Sales Tax',
        programme_name: '50th STP',
        campus: null,
        trainee_count: 32,
        average_progress_percentage: null,
        delivered_hours: 4,
        status: 'unavailable',
        can_manage: false,
      },
    ]}
    />,
  );

  expect(screen.getByRole('progressbar', {
    name: 'Income Tax Law: 63% average learner progress',
  })).toBeInTheDocument();
  expect(screen.getAllByText('Progress unavailable')).toHaveLength(2);
  expect(screen.queryByText(/modules/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Manage' })).not.toBeInTheDocument();
});

it('renders snake_case delivery data and a signed negative monthly change', () => {
  renderComponent(
    <DeliverySummaryCard
      timezone="Asia/Karachi"
      courses={[{
        course_id: 'course-1',
        name: 'Income Tax Law',
        delivered_hours: 12,
      }]}
      delivery={{
        delivered_hours: 12,
        delivered_sessions: 6,
        change_from_last_month_hours: -4,
        this_month_sessions: 2,
        average_attendance_percentage: 88,
        rescheduled_sessions: 1,
        weekly_hours: [{ week_start: '2026-08-17', week_end: '2026-08-23', hours: 0 }],
        recent_sessions: [{
          id: 'session-1',
          scheduled_start: '2026-08-28T22:30:00+00:00',
          title: 'Tax workshop',
          course_code: null,
          duration_minutes: 120,
          present: 20,
          trainee_count: 24,
        }],
      }}
    />,
  );

  expect(screen.getByText('−4 hrs vs last month')).toBeInTheDocument();
  expect(screen.getByText('Week 1: 0 teaching hours')).toBeInTheDocument();
  expect(screen.getByText('20 of 24 present')).toBeInTheDocument();
});
