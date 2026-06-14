import React from 'react';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import SessionLeavesPanel from './SessionLeavesPanel';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getSessionApprovedLeaves: jest.fn(),
}));

const { getSessionApprovedLeaves } = require('./api');

const MOCK_RESPONSE = {
  count: 2,
  results: [
    {
      session_id: 's1',
      title: 'Session 1',
      scheduled_start_time: '2026-06-15T09:00:00Z',
      status: 'scheduled',
      students_on_leave: [{
        user_id: 1,
        email: 'alice@example.com',
        username: 'alice',
        leave_start_date: '2026-06-15',
        leave_end_date: '2026-06-15',
        leave_request_id: 'l1',
      }],
    },
    {
      session_id: 's2',
      title: 'Session 2',
      scheduled_start_time: '2026-06-20T09:00:00Z',
      status: 'scheduled',
      students_on_leave: [],
    },
  ],
};

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <SessionLeavesPanel programKey="prog1" />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

describe('SessionLeavesPanel', () => {
  it('renders Sessions & Approved Leaves heading', async () => {
    getSessionApprovedLeaves.mockResolvedValue(MOCK_RESPONSE);
    wrap();
    await waitFor(() => expect(screen.getByText('Sessions & Approved Leaves')).toBeInTheDocument());
  });

  it('shows session titles in the table', async () => {
    getSessionApprovedLeaves.mockResolvedValue(MOCK_RESPONSE);
    wrap();
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
    expect(screen.getByText('Session 2')).toBeInTheDocument();
  });

  it('shows leave count of 1 for session with a student on leave', async () => {
    getSessionApprovedLeaves.mockResolvedValue(MOCK_RESPONSE);
    wrap();
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('View approved leaves button is disabled for session with 0 leaves', async () => {
    getSessionApprovedLeaves.mockResolvedValue(MOCK_RESPONSE);
    wrap();
    await waitFor(() => expect(screen.getByText('Session 2')).toBeInTheDocument());
    const buttons = screen.getAllByRole('button', { name: /view approved leaves/i });
    const disabledBtn = buttons.find((b) => b.disabled);
    expect(disabledBtn).toBeTruthy();
  });

  it('clicking View approved leaves opens modal with student username', async () => {
    getSessionApprovedLeaves.mockResolvedValue(MOCK_RESPONSE);
    wrap();
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
    const buttons = screen.getAllByRole('button', { name: /view approved leaves/i });
    const enabledBtn = buttons.find((b) => !b.disabled);
    fireEvent.click(enabledBtn);
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
  });

  it('modal shows student email', async () => {
    getSessionApprovedLeaves.mockResolvedValue(MOCK_RESPONSE);
    wrap();
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
    const buttons = screen.getAllByRole('button', { name: /view approved leaves/i });
    const enabledBtn = buttons.find((b) => !b.disabled);
    fireEvent.click(enabledBtn);
    await waitFor(() => expect(screen.getByText('alice@example.com')).toBeInTheDocument());
  });

  it('search input triggers refetch with q param', async () => {
    getSessionApprovedLeaves.mockResolvedValue(MOCK_RESPONSE);
    wrap();
    await waitFor(() => expect(screen.getByText('Session 1')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/search sessions/i), { target: { value: 'Math' } });
    await waitFor(() => expect(getSessionApprovedLeaves).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'Math' }),
    ));
  });

  it('shows error alert on API failure', async () => {
    getSessionApprovedLeaves.mockRejectedValue(new Error('Network error'));
    wrap();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});
