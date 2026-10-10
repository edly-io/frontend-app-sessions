import React from 'react';
import {
  render, screen, fireEvent, waitFor, within,
} from '@testing-library/react';
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

  it('opens a confirmation modal after clicking Delete', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/delete this pending request/i)).toBeInTheDocument();
  });

  it('shows the request details in the confirmation modal', async () => {
    getMyRequests.mockResolvedValue({
      count: 1,
      results: [makeRequest({
        sessions: [{ id: 's9', title: 'Course 1 — Session 9', scheduled_start_time: '2026-08-05T10:00:00Z' }],
      })],
    });
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/course 1 — session 9/i)).toBeInTheDocument();
    expect(within(dialog).getByText('Sessions')).toBeInTheDocument();
  });

  it('calls deleteRequest when the modal is confirmed', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(deleteRequest).toHaveBeenCalledWith('1', 'leave'));
  });

  it('closes the modal on Cancel without deleting', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(deleteRequest).not.toHaveBeenCalled();
  });

  it('shows the API error inside the modal', async () => {
    deleteRequest.mockRejectedValueOnce(new Error('boom'));
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /delete/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^delete$/i }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
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

  it('calls withdrawRequest when the modal is confirmed', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /withdraw/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^withdraw$/i }));
    await waitFor(() => expect(withdrawRequest).toHaveBeenCalledWith('1'));
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

  it('calls withdrawRequest when the modal is confirmed', async () => {
    wrap();
    fireEvent.click(await screen.findByRole('button', { name: /withdraw/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /^withdraw$/i }));
    await waitFor(() => expect(withdrawRequest).toHaveBeenCalledWith('1'));
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
    expect(screen.queryByRole('button', { name: /delete|withdraw/i })).not.toBeInTheDocument();
  });
});
