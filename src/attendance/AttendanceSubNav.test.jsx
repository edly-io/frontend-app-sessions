import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import AttendanceSubNav from './AttendanceSubNav';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const wrap = () => render(
  <MemoryRouter initialEntries={['/test-prog/attendance/by-course']}>
    <Routes>
      <Route
        path="/:programId/attendance/:sub"
        element={(
          <IntlProvider locale="en" messages={{}}>
            <AttendanceSubNav />
          </IntlProvider>
        )}
      />
    </Routes>
  </MemoryRouter>,
);

describe('admin sub-nav', () => {
  it('renders By Course and By Learner links', () => {
    wrap();
    expect(screen.getByText('By Course')).toBeInTheDocument();
    expect(screen.getByText('By Learner')).toBeInTheDocument();
  });

  it('renders a nav element with accessible label', () => {
    wrap();
    expect(screen.getByRole('navigation', { name: /attendance sub-sections/i })).toBeInTheDocument();
  });
});
