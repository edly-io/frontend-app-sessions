import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import LearnerRequestsView from './LearnerRequestsView';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ programId: 'test-program' }),
}));

jest.mock('./api', () => ({
  getMyRequests: jest.fn(),
  deleteRequest: jest.fn().mockResolvedValue({}),
  withdrawRequest: jest.fn().mockResolvedValue({ id: '1', state: 'WITHDRAWAL_PENDING' }),
}));

jest.mock('./CreateRequestModal', () => function MockCreateRequestModal() { return null; });

const { getMyRequests, deleteRequest, withdrawRequest } = require('./api');

const wrap = () => render(
  <IntlProvider locale="en" messages={{}}>
    <MemoryRouter initialEntries={['/test-program/requests']}>
      <Routes>
        <Route path="/:programId/requests" element={<LearnerRequestsView />} />
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
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  getMyRequests.mockResolvedValue({ count: 1, results: [makeRequest()] });
});

// ─── PENDING request ─────────────────────────────────────────────────────────

describe('PENDING request', () => {
  it('shows Delete button', async () => {
    wrap();
    expect(await screen.findByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows confirm step after clicking Delete', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('calls deleteRequest on Confirm click', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(deleteRequest).toHaveBeenCalledWith('1', 'leave');
  });

  it('dismisses confirm step on Cancel click', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }));
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByRole('button', { name: /confirm/i })).not.toBeInTheDocument();
  });
});

// ─── APPROVED leave ───────────────────────────────────────────────────────────

describe('APPROVED leave request', () => {
  beforeEach(() => {
    getMyRequests.mockResolvedValue({
      count: 1,
      results: [makeRequest({ state: 'APPROVED' })],
    });
  });

  it('shows Withdraw button', async () => {
    wrap();
    expect(await screen.findByRole('button', { name: /withdraw/i })).toBeInTheDocument();
  });

  it('calls withdrawRequest on Confirm click', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /withdraw/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(withdrawRequest).toHaveBeenCalledWith('1');
  });

  it('does not show Delete button', async () => {
    wrap();
    await screen.findByRole('button', { name: /withdraw/i });
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });
});

// ─── WITHDRAWAL_REJECTED leave ────────────────────────────────────────────────

describe('WITHDRAWAL_REJECTED leave request', () => {
  beforeEach(() => {
    getMyRequests.mockResolvedValue({
      count: 1,
      results: [makeRequest({ state: 'WITHDRAWAL_REJECTED' })],
    });
  });

  it('shows helper text about denied withdrawal', async () => {
    wrap();
    expect(await screen.findByText(/your previous withdrawal request was denied/i)).toBeInTheDocument();
  });

  it('shows Withdraw button', async () => {
    wrap();
    expect(await screen.findByRole('button', { name: /withdraw/i })).toBeInTheDocument();
  });

  it('calls withdrawRequest on Confirm', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /withdraw/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(withdrawRequest).toHaveBeenCalledWith('1');
  });
});

// ─── States with no action ────────────────────────────────────────────────────

describe.each([
  ['WITHDRAWAL_PENDING'],
  ['CANCELLED'],
  ['WITHDRAWN'],
  ['REJECTED'],
])('%s leave request', (state) => {
  beforeEach(() => {
    getMyRequests.mockResolvedValue({
      count: 1,
      results: [makeRequest({ state })],
    });
  });

  it('shows no action button', async () => {
    wrap();
    // Wait for the table to render (Status column shows the state label)
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /delete|withdraw|confirm/i })).not.toBeInTheDocument();
  });
});
