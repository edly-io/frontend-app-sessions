import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import SessionsLanding from './SessionsLanding';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('../programs/ProgramsListPage', () => function ProgramsListPage() { return <div>Programs list page</div>; });

it('renders the programs list page', () => {
  render(
    <MemoryRouter>
      <SessionsLanding />
    </MemoryRouter>,
  );
  expect(screen.getByText('Programs list page')).toBeInTheDocument();
});
