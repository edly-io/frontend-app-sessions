import React from 'react';
import {
  render, screen, waitFor, fireEvent,
} from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import LeaveUsagePanel from './LeaveUsagePanel';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getLeaveUsage: jest.fn(),
}));

const { getLeaveUsage } = require('./api');

const USAGE_DATA = {
  program_key: 'prog1',
  threshold: 7,
  leaves: [
    {
      user_id: 1,
      username: 'alice',
      email: 'alice@example.com',
      full_name: 'Alice Smith',
      total_leaves_availed: 3,
      breakdown: { full_day_leaves: 2, session_specific_leaves: 1 },
    },
    {
      user_id: 2,
      username: 'bob',
      email: 'bob@example.com',
      full_name: 'Bob Jones',
      total_leaves_availed: 8,
      breakdown: { full_day_leaves: 6, session_specific_leaves: 2 },
    },
  ],
};

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <LeaveUsagePanel programKey="prog1" />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

describe('LeaveUsagePanel', () => {
  it('shows the Leave Usage heading and fetches data', async () => {
    getLeaveUsage.mockResolvedValue(USAGE_DATA);
    wrap();
    await waitFor(() => expect(screen.getByText('Leave Usage')).toBeInTheDocument());
    expect(getLeaveUsage).toHaveBeenCalledWith({ program_key: 'prog1' });
  });

  it('renders all student rows after fetch', async () => {
    getLeaveUsage.mockResolvedValue(USAGE_DATA);
    wrap();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('shows availed / threshold counts per row', async () => {
    getLeaveUsage.mockResolvedValue(USAGE_DATA);
    wrap();
    await waitFor(() => expect(screen.getByText('3 / 7')).toBeInTheDocument());
    expect(screen.getByText('8 / 7')).toBeInTheDocument();
  });

  it('shows "No learners found" when leaves array is empty', async () => {
    getLeaveUsage.mockResolvedValue({ ...USAGE_DATA, leaves: [] });
    wrap();
    await waitFor(() => expect(screen.getByText(/no learners found/i)).toBeInTheDocument());
  });

  it('shows error alert on API failure', async () => {
    getLeaveUsage.mockRejectedValue(new Error('Network error'));
    wrap();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('search input re-fetches with q param', async () => {
    getLeaveUsage.mockResolvedValue(USAGE_DATA);
    wrap();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/search by name or email/i), { target: { value: 'alice' } });
    await waitFor(() => expect(getLeaveUsage).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'alice' }),
    ));
  });

  it('threshold-exceeded filter re-fetches with threshold_exceeded param', async () => {
    getLeaveUsage.mockResolvedValue(USAGE_DATA);
    wrap();
    await waitFor(() => expect(screen.getByText('Alice Smith')).toBeInTheDocument());
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'threshold_exceeded' } });
    await waitFor(() => expect(getLeaveUsage).toHaveBeenCalledWith(
      expect.objectContaining({ threshold_exceeded: true }),
    ));
  });
});
