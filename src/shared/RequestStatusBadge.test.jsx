import React from 'react';
import { render, screen } from '@testing-library/react';
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

it('renders "Remote approved" for APPROVED remote_session', () => {
  wrap({ state: 'APPROVED', type_slug: 'remote_session' });
  expect(screen.getByText('Remote approved')).toBeInTheDocument();
});

it('renders status + type label for PENDING leave', () => {
  wrap({ state: 'PENDING', type_slug: 'leave' });
  expect(screen.getByText(/Pending/)).toBeInTheDocument();
});

it('renders status + type label for REJECTED request', () => {
  wrap({ state: 'REJECTED', type_slug: 'remote_session' });
  expect(screen.getByText(/Rejected/)).toBeInTheDocument();
});

it('falls back gracefully for unknown type_slug', () => {
  wrap({ state: 'PENDING', type_slug: 'unknown_type' });
  expect(screen.getByText(/Pending/)).toBeInTheDocument();
});
