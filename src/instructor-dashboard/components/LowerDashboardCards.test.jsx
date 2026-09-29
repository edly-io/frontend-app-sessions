import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import { MemoryRouter } from 'react-router-dom';

import AttendanceToMarkCard from './AttendanceToMarkCard';
import FeedbackToSubmitCard from './FeedbackToSubmitCard';
import HolidaysCard from './HolidaysCard';

const renderWithIntl = component => render(
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>{component}</IntlProvider>
  </MemoryRouter>,
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
  expect(screen.queryByRole('button', { name: 'View all' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Fill form' }));
  expect(onOpenFeedback).toHaveBeenCalledWith(602);
});

it('shows five feedback requests by default and expands without fetching', async () => {
  const user = userEvent.setup();
  const feedback = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    feedback_name: `Feedback ${index + 1}`,
    form_name: `Form ${index + 1}`,
    type: 'course',
    subject: null,
    course_code: `TX-${index + 1}`,
    course_name: `Course ${index + 1}`,
    deadline: '2026-08-28',
    status: 'pending',
    urgent: false,
    submitted_at: null,
    can_submit: true,
  }));

  renderWithIntl(
    <FeedbackToSubmitCard
      pendingCount={6}
      onOpenFeedback={jest.fn()}
      feedback={feedback}
    />,
  );

  expect(screen.getByText('Course 5')).toBeInTheDocument();
  expect(screen.queryByText('Course 6')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View all' }));
  expect(screen.getByText('Course 6')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show less' }));
  expect(screen.queryByText('Course 6')).not.toBeInTheDocument();
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
  expect(screen.queryByRole('button', { name: 'View all' })).not.toBeInTheDocument();
});

it('expands holidays and displays multi-day date ranges', async () => {
  const user = userEvent.setup();
  const holidays = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    type: 'public_holiday',
    name: `Holiday ${index + 1}`,
    description: null,
    start_date: `2026-08-${String(index + 20).padStart(2, '0')}`,
    end_date: `2026-08-${String(index + 21).padStart(2, '0')}`,
    no_sessions: true,
    campus_ids: [2],
  }));

  renderWithIntl(<HolidaysCard holidays={holidays} />);

  expect(screen.getByText('Aug 20 – Aug 21')).toBeInTheDocument();
  expect(screen.getByText('Holiday 5')).toBeInTheDocument();
  expect(screen.queryByText('Holiday 6')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View all' }));
  expect(screen.getByText('Holiday 6')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show less' }));
  expect(screen.queryByText('Holiday 6')).not.toBeInTheDocument();
});
