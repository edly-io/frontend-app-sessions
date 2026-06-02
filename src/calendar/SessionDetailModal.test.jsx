import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import SessionDetailModal from './SessionDetailModal';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const BASE_SESSION = {
  title: 'Test Session',
  status: 'scheduled',
  scheduled_start_time: '2026-06-01T10:00:00.000Z',
  scheduled_end_time: '2026-06-01T11:00:00.000Z',
};

const wrap = (session, props = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <SessionDetailModal session={session} isOpen onClose={jest.fn()} {...props} />
  </IntlProvider>,
);

it('renders nothing when session is null', () => {
  const { container } = render(
    <IntlProvider locale="en" messages={{}}>
      <SessionDetailModal session={null} isOpen onClose={jest.fn()} />
    </IntlProvider>,
  );
  expect(container).toBeEmptyDOMElement();
});

it('renders the session title', () => {
  wrap(BASE_SESSION);
  expect(screen.getByText('Test Session')).toBeInTheDocument();
});

it('renders course name when provided', () => {
  wrap({ ...BASE_SESSION, course_name: 'Intro to Python' });
  expect(screen.getByText('Intro to Python')).toBeInTheDocument();
});

it('renders description in a separate block', () => {
  wrap({ ...BASE_SESSION, description: 'Topic overview for today' });
  expect(screen.getByText('Topic overview for today')).toBeInTheDocument();
});

it('renders duration when provided', () => {
  wrap({ ...BASE_SESSION, duration_minutes: 90 });
  expect(screen.getByText('90 min')).toBeInTheDocument();
});

it('renders timezone when provided', () => {
  wrap({ ...BASE_SESSION, timezone: 'Asia/Karachi' });
  expect(screen.getByText('Asia/Karachi')).toBeInTheDocument();
});

it('renders instructor names when provided', () => {
  wrap({ ...BASE_SESSION, instructor_names: ['Alice', 'Bob'] });
  expect(screen.getByText('Alice, Bob')).toBeInTheDocument();
});

it('renders "Join meeting" button when join URL is set', () => {
  wrap({
    ...BASE_SESSION,
    meeting_id: 'mid',
    meeting_join_url: 'https://zoom.us/j/123',
  });
  expect(screen.getByRole('button', { name: /join meeting/i })).toBeInTheDocument();
});

it('renders "Start as host" button when start URL is set', () => {
  wrap({
    ...BASE_SESSION,
    meeting_id: 'mid',
    meeting_start_url: 'https://zoom.us/s/123',
    meeting_join_url: 'https://zoom.us/j/123',
  });
  expect(screen.getByRole('button', { name: /start as host/i })).toBeInTheDocument();
});

it('renders meeting password when provided', () => {
  wrap({
    ...BASE_SESSION,
    meeting_id: 'mid',
    meeting_join_url: 'https://zoom.us/j/123',
    meeting_password: 'secret',
  });
  expect(screen.getByText('secret')).toBeInTheDocument();
});

it('calls onClose when the footer Close button is clicked', () => {
  const onClose = jest.fn();
  wrap(BASE_SESSION, { onClose });
  // The modal has two "Close" buttons (header X + footer text button); target the footer one
  const closeButtons = screen.getAllByRole('button', { name: /close/i });
  fireEvent.click(closeButtons[closeButtons.length - 1]);
  expect(onClose).toHaveBeenCalled();
});

it('renders weekly recurrence summary', () => {
  wrap({
    ...BASE_SESSION,
    is_recurring: true,
    recurrence: { type: 2, repeat_interval: 1, end_times: 5 },
  });
  expect(screen.getByText(/Weekly/i)).toBeInTheDocument();
  expect(screen.getByText(/5 occurrences/i)).toBeInTheDocument();
});

it('shows Zoom platform label for zoom platform sessions', () => {
  wrap({ ...BASE_SESSION, platform: 'zoom' });
  expect(screen.getByText('Zoom')).toBeInTheDocument();
});

it('shows In Class label for manual platform sessions', () => {
  wrap({ ...BASE_SESSION, platform: 'manual' });
  expect(screen.getByText('In Class')).toBeInTheDocument();
});
