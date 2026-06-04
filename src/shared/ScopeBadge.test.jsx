import React from 'react';
import { render, screen } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import ScopeBadge from './ScopeBadge';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const wrap = (scope) => render(
  <IntlProvider locale="en" messages={{}}>
    <ScopeBadge scope={scope} />
  </IntlProvider>,
);

it('renders "Open to all learners" for public scope', () => {
  wrap('public');
  expect(screen.getByText('Open to all learners')).toBeInTheDocument();
});

it('renders "Approved learners only" for gated scope', () => {
  wrap('gated');
  expect(screen.getByText('Approved learners only')).toBeInTheDocument();
});

it('renders "In-person" for in_person scope', () => {
  wrap('in_person');
  expect(screen.getByText('In-person')).toBeInTheDocument();
});

it('renders nothing for an unknown scope', () => {
  const { container } = wrap('unknown_scope');
  expect(container).toBeEmptyDOMElement();
});

it('renders an info tooltip button for each known scope', () => {
  wrap('public');
  const btn = screen.getByRole('button', { name: /zoom link is visible/i });
  expect(btn).toBeInTheDocument();
});
