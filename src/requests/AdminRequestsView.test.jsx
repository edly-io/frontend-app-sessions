import React from 'react';
import {
  render, screen, fireEvent, within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import AdminRequestsView from './AdminRequestsView';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ programId: 'test-program' }),
}));

jest.mock('./api', () => ({
  getRequests: jest.fn(),
  reviewRequest: jest.fn().mockResolvedValue({ id: '1', state: 'APPROVED' }),
  bulkApproveLeaves: jest.fn(),
  getLeaveUsage: jest.fn().mockResolvedValue({ threshold: 5, leaves: [] }),
}));

jest.mock('../app/api', () => ({
  getProgram: jest.fn().mockResolvedValue({ threshold: 5 }),
}));

jest.mock('./CreateRequestModal', () => function MockCreateRequestModal() { return null; });
jest.mock('./SessionLeavesPanel', () => function MockSessionLeavesPanel() { return null; });

const { getRequests, reviewRequest } = require('./api');

const wrap = (props = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter initialEntries={['/test-program/requests']}>
      <Routes>
        <Route path="/:programId/requests" element={<AdminRequestsView {...props} />} />
      </Routes>
    </MemoryRouter>
  </IntlProvider>,
);

const makeRequest = (overrides = {}) => ({
  id: '1',
  request_type_label: 'leave',
  state: 'PENDING',
  reason: 'Test reason',
  reviewer_note: '',
  created: '2026-06-01T10:00:00Z',
  attachment: null,
  submitter_name: 'Alice',
  submitter_email: 'alice@example.com',
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  getRequests.mockResolvedValue({ count: 1, results: [makeRequest()] });
});

// ─── PENDING request ──────────────────────────────────────────────────────────

describe('PENDING request actions', () => {
  it('shows Approve and Reject buttons', async () => {
    wrap();
    expect(await screen.findByRole('button', { name: /^approve$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^reject$/i })).toBeInTheDocument();
  });

  it('does not show withdrawal action buttons for PENDING', async () => {
    wrap();
    await screen.findByRole('button', { name: /^approve$/i });
    expect(screen.queryByRole('button', { name: /approve withdrawal/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject withdrawal/i })).not.toBeInTheDocument();
  });

  it('calls reviewRequest with APPROVED when Approve is clicked', async () => {
    reviewRequest.mockResolvedValue({ id: '1', state: 'APPROVED' });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /^approve$/i }));
    expect(reviewRequest).toHaveBeenCalledWith('1', { state: 'APPROVED', reviewer_note: '' }, 'leave');
  });

  it('opens note modal when Reject is clicked', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /^reject$/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls reviewRequest with REJECTED and note on modal confirm', async () => {
    reviewRequest.mockResolvedValue({ id: '1', state: 'REJECTED' });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /^reject$/i }));
    fireEvent.change(
      screen.getByPlaceholderText(/let them know why/i),
      { target: { value: 'No capacity' } },
    );
    fireEvent.click(screen.getByRole('button', { name: /reject request/i }));
    expect(reviewRequest).toHaveBeenCalledWith('1', { state: 'REJECTED', reviewer_note: 'No capacity' }, 'leave');
  });
});

// ─── WITHDRAWAL_PENDING request ───────────────────────────────────────────────

describe('WITHDRAWAL_PENDING request actions', () => {
  beforeEach(() => {
    getRequests.mockResolvedValue({
      count: 1,
      results: [makeRequest({ state: 'WITHDRAWAL_PENDING' })],
    });
  });

  it('shows Approve Withdrawal and Reject Withdrawal buttons', async () => {
    wrap();
    expect(await screen.findByRole('button', { name: /approve withdrawal/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject withdrawal/i })).toBeInTheDocument();
  });

  it('does not show plain Approve/Reject buttons for WITHDRAWAL_PENDING', async () => {
    wrap();
    await screen.findByRole('button', { name: /approve withdrawal/i });
    expect(screen.queryByRole('button', { name: /^approve$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^reject$/i })).not.toBeInTheDocument();
  });

  it('calls reviewRequest with WITHDRAWN when Approve Withdrawal is clicked', async () => {
    reviewRequest.mockResolvedValue({ id: '1', state: 'WITHDRAWN' });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /approve withdrawal/i }));
    expect(reviewRequest).toHaveBeenCalledWith('1', { state: 'WITHDRAWN', reviewer_note: '' }, 'leave');
  });

  it('opens note modal with "Reject withdrawal" title when Reject Withdrawal is clicked', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /reject withdrawal/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('calls reviewRequest with WITHDRAWAL_REJECTED on modal confirm', async () => {
    reviewRequest.mockResolvedValue({ id: '1', state: 'WITHDRAWAL_REJECTED' });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /reject withdrawal/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /reject withdrawal/i }));
    expect(reviewRequest).toHaveBeenCalledWith(
      '1',
      { state: 'WITHDRAWAL_REJECTED', reviewer_note: '' },
      'leave',
    );
  });
});

// ─── would_exceed_threshold flag ─────────────────────────────────────────────

describe('would_exceed_threshold flag', () => {
  beforeEach(() => {
    getRequests.mockResolvedValue({
      count: 1,
      results: [makeRequest({ would_exceed_threshold: true })],
    });
  });

  it('shows threshold warning when would_exceed_threshold is true and lockedType is leave', async () => {
    wrap({ lockedType: 'leave' });
    expect(await screen.findByText(/approval would exceed threshold/i)).toBeInTheDocument();
  });

  it('does NOT show threshold warning when lockedType is not leave', async () => {
    wrap();
    await screen.findByRole('table');
    expect(screen.queryByText(/approval would exceed threshold/i)).not.toBeInTheDocument();
  });
});

describe('would_exceed_threshold false', () => {
  beforeEach(() => {
    getRequests.mockResolvedValue({
      count: 1,
      results: [makeRequest({ would_exceed_threshold: false })],
    });
  });

  it('does NOT show threshold warning when would_exceed_threshold is false', async () => {
    wrap({ lockedType: 'leave' });
    await screen.findByRole('table');
    expect(screen.queryByText(/approval would exceed threshold/i)).not.toBeInTheDocument();
  });
});

// ─── Read-only mode ───────────────────────────────────────────────────────────

describe('readOnly mode', () => {
  it('shows no action buttons for any state', async () => {
    wrap({ readOnly: true });
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /approve|reject/i })).not.toBeInTheDocument();
  });
});

// ─── Terminal states — no action buttons ─────────────────────────────────────

describe.each([
  ['APPROVED'],
  ['REJECTED'],
  ['CANCELLED'],
  ['WITHDRAWN'],
])('%s request', (state) => {
  beforeEach(() => {
    getRequests.mockResolvedValue({
      count: 1,
      results: [makeRequest({ state })],
    });
  });

  it('shows no action buttons', async () => {
    wrap();
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /approve|reject/i })).not.toBeInTheDocument();
  });
});
