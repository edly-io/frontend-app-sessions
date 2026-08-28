import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';

import AttendanceToMarkCard from './AttendanceToMarkCard';
import FeedbackToSubmitCard from './FeedbackToSubmitCard';
import HolidaysCard from './HolidaysCard';

const renderWithIntl = component => render(
  <IntlProvider locale="en" messages={{}}>{component}</IntlProvider>,
);

it('uses the summary pending count and opens only submittable feedback', async () => {
  const user = userEvent.setup();
  const onOpenFeedback = jest.fn();
  renderWithIntl(
    <FeedbackToSubmitCard
      pendingCount={7}
      onOpenFeedback={onOpenFeedback}
      feedback={[
        {
          id: 602,
          feedback_name: 'Faculty evaluation',
          form_name: 'Faculty Evaluation Form',
          type: 'trainee',
          subject: { id: 245, full_name: 'Ifrah Saleem' },
          course_code: null,
          course_name: null,
          deadline: '2026-08-28',
          status: 'pending',
          urgent: true,
          submitted_at: null,
          can_submit: true,
        },
        {
          id: 603,
          feedback_name: 'Course survey',
          form_name: 'Course Form',
          type: 'course',
          subject: null,
          course_code: 'TX-101',
          course_name: 'Income Tax Law',
          deadline: '2026-08-20',
          status: 'expired',
          urgent: false,
          submitted_at: null,
          can_submit: false,
        },
      ]}
    />,
  );

  expect(screen.getByText('7 pending')).toBeInTheDocument();
  expect(screen.getByText('Expired')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Fill form' }));
  expect(onOpenFeedback).toHaveBeenCalledWith(602);
});

it('shows attendance as information without a marking action', () => {
  renderWithIntl(
    <AttendanceToMarkCard sessions={[{
      session_id: 'session-1',
      program_key: 'program-v1:FBR+STP50+2026',
      course_id: 'course-v1:FBR+TX101+2026',
      course_code: 'TX-101',
      title: 'Withholding Tax Basics',
      session_start: '2026-08-23T09:30:00+05:00',
      trainee_count: 32,
      unmarked_count: 4,
      age_days: 1,
      can_mark: false,
    }]}
    />,
  );

  expect(screen.getByText('4 unmarked')).toBeInTheDocument();
  expect(screen.getByText(/32 trainees/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Mark attendance' })).not.toBeInTheDocument();
});

it('accepts snake-case holidays with a nullable description', () => {
  renderWithIntl(
    <HolidaysCard holidays={[{
      id: 17,
      type: 'public_holiday',
      name: 'Chehlum',
      description: null,
      start_date: '2026-08-26',
      end_date: '2026-08-26',
      no_sessions: true,
      campus_ids: [2],
    }]}
    />,
  );

  expect(screen.getByText('Chehlum')).toBeInTheDocument();
  expect(screen.getByText(/Wednesday/)).toBeInTheDocument();
});
