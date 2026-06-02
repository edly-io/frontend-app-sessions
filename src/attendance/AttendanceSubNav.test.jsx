import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import AttendanceSubNav from './AttendanceSubNav';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const wrap = (isAdmin) => render(
  <MemoryRouter initialEntries={['/test-prog/attendance/sessions']}>
    <Routes>
      <Route
        path="/:programId/attendance/:sub"
        element={(
          <IntlProvider locale="en" messages={{}}>
            <AttendanceSubNav isAdmin={isAdmin} />
          </IntlProvider>
        )}
      />
    </Routes>
  </MemoryRouter>,
);

describe('admin sub-nav', () => {
  it('renders Sessions, Course Summary, and Per-Learner links', () => {
    wrap(true);
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Course Summary')).toBeInTheDocument();
    expect(screen.getByText('Per-Learner')).toBeInTheDocument();
  });

  it('renders a nav element with accessible label', () => {
    wrap(true);
    expect(screen.getByRole('navigation', { name: /attendance sub-sections/i })).toBeInTheDocument();
  });
});

describe('learner sub-nav', () => {
  it('renders nothing because there is only one item', () => {
    const { container } = wrap(false);
    expect(container).toBeEmptyDOMElement();
  });
});
