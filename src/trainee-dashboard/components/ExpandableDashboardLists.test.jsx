import React from 'react';
import { IntlProvider } from '@edx/frontend-platform/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

import FeedbackCard from './FeedbackCard';
import HolidaysCard from './HolidaysCard';
import UpcomingSessionsCard from './UpcomingSessionsCard';

const renderComponent = component => render(
  <MemoryRouter>
    <IntlProvider locale="en" messages={{}}>{component}</IntlProvider>
  </MemoryRouter>,
);

it('expands and collapses the complete upcoming sessions array', async () => {
  const user = userEvent.setup();
  const sessions = Array.from({ length: 6 }, (_, index) => ({
    id: `session-${index + 1}`,
    title: `Session ${index + 1}`,
    course_code: 'TX-101',
    scheduled_start: `2026-10-${String(index + 10).padStart(2, '0')}T09:30:00+05:00`,
    duration_minutes: 60,
    mode: 'on_site',
    location: null,
    instructors: [{ full_name: 'Ayesha Khan' }],
    meeting_join_url: null,
    can_join: false,
    can_view_details: true,
  }));

  renderComponent(<UpcomingSessionsCard sessions={sessions} programKey="program-v1:FBR+STP+2026" />);

  expect(screen.getByText('Session 5')).toBeInTheDocument();
  expect(screen.queryByText('Session 6')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View all' }));
  expect(screen.getByText('Session 6')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show less' }));
  expect(screen.queryByText('Session 6')).not.toBeInTheDocument();
});

it('uses can_join instead of the URL to gate the join action', () => {
  const session = {
    id: 'session-1',
    title: 'Session 1',
    course_code: 'TX-101',
    scheduled_start: '2026-10-10T09:30:00+05:00',
    duration_minutes: 60,
    mode: 'online',
    location: null,
    instructors: [{ full_name: 'Ayesha Khan' }],
    meeting_join_url: 'https://meet.example.com/session-1',
    can_join: false,
    can_view_details: true,
  };

  const { rerender } = renderComponent(
    <UpcomingSessionsCard sessions={[session]} programKey="program-v1:FBR+STP+2026" />,
  );

  expect(screen.queryByRole('link', { name: 'Join session' })).not.toBeInTheDocument();

  rerender(
    <MemoryRouter>
      <IntlProvider locale="en" messages={{}}>
        <UpcomingSessionsCard
          sessions={[{ ...session, can_join: true }]}
          programKey="program-v1:FBR+STP+2026"
        />
      </IntlProvider>
    </MemoryRouter>,
  );

  expect(screen.getByRole('link', { name: 'Join session' })).toHaveAttribute(
    'href',
    'https://meet.example.com/session-1',
  );
});

it('expands and collapses the complete feedback array', async () => {
  const user = userEvent.setup();
  const feedback = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    feedback_name: `Feedback ${index + 1}`,
    form_name: `Form ${index + 1}`,
    subject: null,
    course_name: `Course ${index + 1}`,
    deadline: '2026-10-30',
    status: 'pending',
    urgent: false,
    can_submit: true,
  }));

  renderComponent(
    <FeedbackCard feedback={feedback} pendingCount={6} onOpenFeedback={jest.fn()} />,
  );

  expect(screen.getByText('Feedback 5')).toBeInTheDocument();
  expect(screen.queryByText('Feedback 6')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View all' }));
  expect(screen.getByText('Feedback 6')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show less' }));
  expect(screen.queryByText('Feedback 6')).not.toBeInTheDocument();
});

it('expands and collapses the complete holidays array', async () => {
  const user = userEvent.setup();
  const holidays = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    name: `Holiday ${index + 1}`,
    description: null,
    start_date: `2026-10-${String(index + 10).padStart(2, '0')}`,
    end_date: `2026-10-${String(index + 10).padStart(2, '0')}`,
    no_sessions: true,
  }));

  renderComponent(<HolidaysCard holidays={holidays} />);

  expect(screen.getByText('Holiday 5')).toBeInTheDocument();
  expect(screen.queryByText('Holiday 6')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View all' }));
  expect(screen.getByText('Holiday 6')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show less' }));
  expect(screen.queryByText('Holiday 6')).not.toBeInTheDocument();
});
