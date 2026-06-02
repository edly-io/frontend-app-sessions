import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import RequestDetailCell from './RequestDetailCell';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const wrap = (req) => render(
  <IntlProvider locale="en" messages={{}}>
    <RequestDetailCell req={req} />
  </IntlProvider>,
);

// ─── remote_session ───────────────────────────────────────────────────────────

describe('remote_session', () => {
  const req = {
    request_type_label: 'remote_session',
    sessions: [
      { id: 's1', title: 'Session A', scheduled_start_time: '2026-06-01T10:00:00' },
    ],
  };

  it('renders a Details toggle button', () => {
    wrap(req);
    expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument();
  });

  it('does not show a mode badge', () => {
    wrap(req);
    expect(screen.queryByText('Full Day')).not.toBeInTheDocument();
    expect(screen.queryByText('Session-specific')).not.toBeInTheDocument();
  });

  it('expands to show session list on click', () => {
    wrap(req);
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText(/Session A/)).toBeInTheDocument();
  });

  it('collapses again on second click', () => {
    wrap(req);
    const btn = screen.getByRole('button', { name: /details/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByText(/Session A/)).not.toBeInTheDocument();
  });

  it('shows "No sessions" when sessions array is empty', () => {
    wrap({ request_type_label: 'remote_session', sessions: [] });
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText('No sessions')).toBeInTheDocument();
  });
});

// ─── full-day leave ───────────────────────────────────────────────────────────

describe('full-day leave', () => {
  const req = {
    request_type_label: 'leave',
    leave_start_date: '2026-06-01',
    leave_end_date: '2026-06-03',
    sessions: [],
  };

  it('shows the Full Day badge', () => {
    wrap(req);
    expect(screen.getByText('Full Day')).toBeInTheDocument();
  });

  it('expands to show "No sessions in this range" when no sessions', () => {
    wrap(req);
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText('No sessions in this range')).toBeInTheDocument();
  });

  it('shows session count when sessions are in range', () => {
    wrap({
      ...req,
      sessions: [
        { id: 's1', title: 'S1', scheduled_start_time: '2026-06-01T10:00:00' },
        { id: 's2', title: 'S2', scheduled_start_time: '2026-06-02T10:00:00' },
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText('2 sessions in this range')).toBeInTheDocument();
  });

  it('shows date range in expanded panel', () => {
    wrap(req);
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText(/Jun 1, 2026/)).toBeInTheDocument();
  });

  it('shows single date when start and end are the same', () => {
    wrap({
      request_type_label: 'leave',
      leave_start_date: '2026-06-01',
      leave_end_date: '2026-06-01',
      sessions: [],
    });
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText('Jun 1, 2026')).toBeInTheDocument();
  });
});

// ─── session-specific leave ───────────────────────────────────────────────────

describe('session-specific leave', () => {
  const req = {
    request_type_label: 'leave',
    leave_start_date: null,
    leave_end_date: null,
    sessions: [
      { id: 's1', title: 'Python Basics', scheduled_start_time: '2026-06-05T10:00:00' },
    ],
  };

  it('shows the Session-specific badge', () => {
    wrap(req);
    expect(screen.getByText('Session-specific')).toBeInTheDocument();
  });

  it('expands to show linked session title', () => {
    wrap(req);
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText(/Python Basics/)).toBeInTheDocument();
  });
});
