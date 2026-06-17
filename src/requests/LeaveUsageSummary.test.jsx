import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import LeaveUsageSummary from './LeaveUsageSummary';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('./api', () => ({
  getLeaveUsage: jest.fn(),
}));

jest.mock('../app/useConfig', () => ({
  useConfig: jest.fn().mockReturnValue({ data: { user_role: 'learner' } }),
}));

const { getLeaveUsage } = require('./api');
const { useConfig } = require('../app/useConfig');

const makeUsage = (availed, threshold = 7) => ({
  program_key: 'prog1',
  threshold,
  leaves: [{
    user_id: 1,
    username: 'learner1',
    email: 'learner1@example.com',
    full_name: 'Test Learner',
    total_leaves_availed: availed,
    breakdown: { full_day_leaves: availed, session_specific_leaves: 0 },
  }],
});

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <LeaveUsageSummary programKey="prog1" />
  </IntlProvider>,
);

beforeEach(() => jest.clearAllMocks());

describe('LeaveUsageSummary', () => {
  it('renders own availed count and threshold', async () => {
    getLeaveUsage.mockResolvedValue(makeUsage(3));
    wrap();
    await waitFor(() => expect(screen.getByText('3 / 7')).toBeInTheDocument());
  });

  it('does NOT show threshold warning when under limit', async () => {
    getLeaveUsage.mockResolvedValue(makeUsage(3));
    wrap();
    await waitFor(() => expect(screen.queryByText(/reached or exceeded/i)).not.toBeInTheDocument());
  });

  it('shows warning when availed equals threshold', async () => {
    getLeaveUsage.mockResolvedValue(makeUsage(7));
    wrap();
    await waitFor(() => expect(screen.getByText(/reached or exceeded/i)).toBeInTheDocument());
  });

  it('shows warning when availed exceeds threshold', async () => {
    getLeaveUsage.mockResolvedValue(makeUsage(9));
    wrap();
    await waitFor(() => expect(screen.getByText(/reached or exceeded/i)).toBeInTheDocument());
  });

  it('shows error alert on API failure', async () => {
    getLeaveUsage.mockRejectedValue(new Error('fail'));
    wrap();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });

  it('renders nothing when leaves array is empty', async () => {
    getLeaveUsage.mockResolvedValue({ threshold: 7, leaves: [] });
    const { container } = wrap();
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('shows "X taken" label when threshold is 0 (instructor mode)', async () => {
    getLeaveUsage.mockResolvedValue(makeUsage(3, 0));
    wrap();
    await waitFor(() => expect(screen.getByText('3 taken')).toBeInTheDocument());
    expect(screen.queryByText(/3 \/ 0/)).not.toBeInTheDocument();
  });

  it('does NOT show threshold warning when threshold is 0', async () => {
    getLeaveUsage.mockResolvedValue(makeUsage(9, 0));
    wrap();
    await waitFor(() => expect(screen.getByText('9 taken')).toBeInTheDocument());
    expect(screen.queryByText(/reached or exceeded/i)).not.toBeInTheDocument();
  });

  it('hides bar and threshold for instructor even when threshold > 0', async () => {
    useConfig.mockReturnValue({ data: { user_role: 'instructor' } });
    getLeaveUsage.mockResolvedValue(makeUsage(3, 7));
    wrap();
    await waitFor(() => expect(screen.getByText('3 taken')).toBeInTheDocument());
    expect(screen.queryByText('3 / 7')).not.toBeInTheDocument();
    expect(screen.queryByText(/reached or exceeded/i)).not.toBeInTheDocument();
  });
});
