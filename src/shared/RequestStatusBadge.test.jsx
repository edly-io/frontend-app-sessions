import React from 'react';
import { render, screen } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import RequestStatusBadge from './RequestStatusBadge';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const wrap = (request) => render(
  <IntlProvider locale="en" messages={{}}>
    <RequestStatusBadge request={request} />
  </IntlProvider>,
);

it('renders nothing when request is null', () => {
  const { container } = wrap(null);
  expect(container).toBeEmptyDOMElement();
});

// ─── type_slug shape (requests list API) ─────────────────────────────────────

it('renders "Remote approved" for APPROVED remote_session via type_slug', () => {
  wrap({ state: 'APPROVED', type_slug: 'remote_session' });
  expect(screen.getByText('Remote approved')).toBeInTheDocument();
});

it('renders "Leave approved" for APPROVED leave via type_slug', () => {
  wrap({ state: 'APPROVED', type_slug: 'leave' });
  expect(screen.getByText('Leave approved')).toBeInTheDocument();
});

it('renders status + type label for PENDING leave via type_slug', () => {
  wrap({ state: 'PENDING', type_slug: 'leave' });
  expect(screen.getByText(/Pending/)).toBeInTheDocument();
});

it('renders status + type label for REJECTED request via type_slug', () => {
  wrap({ state: 'REJECTED', type_slug: 'remote_session' });
  expect(screen.getByText(/Rejected/)).toBeInTheDocument();
});

// ─── type shape (calendar API / session.my_request) ──────────────────────────

it('renders "Remote approved" for APPROVED remote_session via type field', () => {
  wrap({ state: 'APPROVED', type: 'remote_session' });
  expect(screen.getByText('Remote approved')).toBeInTheDocument();
});

it('renders "Leave approved" for APPROVED leave via type field', () => {
  wrap({ state: 'APPROVED', type: 'leave' });
  expect(screen.getByText('Leave approved')).toBeInTheDocument();
});

it('type_slug takes precedence over type when both are present', () => {
  wrap({ state: 'APPROVED', type_slug: 'remote_session', type: 'leave' });
  expect(screen.getByText('Remote approved')).toBeInTheDocument();
});

// ─── new states ──────────────────────────────────────────────────────────────

it('renders "Leave withdrawn" for WITHDRAWN leave', () => {
  wrap({ state: 'WITHDRAWN', type_slug: 'leave' });
  expect(screen.getByText('Leave withdrawn')).toBeInTheDocument();
});

it('renders "Cancelled" badge for CANCELLED leave', () => {
  wrap({ state: 'CANCELLED', type_slug: 'leave' });
  expect(screen.getByText(/Cancelled/)).toBeInTheDocument();
});

it('renders "Withdrawal Under Review" badge for WITHDRAWAL_PENDING leave', () => {
  wrap({ state: 'WITHDRAWAL_PENDING', type_slug: 'leave' });
  expect(screen.getByText(/Withdrawal Under Review/)).toBeInTheDocument();
});

it('renders "Withdrawal Denied" badge for WITHDRAWAL_REJECTED leave', () => {
  wrap({ state: 'WITHDRAWAL_REJECTED', type_slug: 'leave' });
  expect(screen.getByText(/Withdrawal Denied/)).toBeInTheDocument();
});

// ─── fallback ─────────────────────────────────────────────────────────────────

it('falls back gracefully for unknown type', () => {
  wrap({ state: 'PENDING', type_slug: 'unknown_type' });
  expect(screen.getByText(/Pending/)).toBeInTheDocument();
});
