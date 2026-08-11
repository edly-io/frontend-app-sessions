import React from 'react';
import { render, screen, within } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';

import TraineeDashboardPage from './TraineeDashboardPage';

jest.mock('../plugin-slots/HeaderSlot', () => () => null);
jest.mock('@edx/frontend-component-footer', () => ({ FooterSlot: () => null }));

const renderDashboard = () => render(
  <IntlProvider locale="en" messages={{}}>
    <TraineeDashboardPage />
  </IntlProvider>,
);

it('renders the static trainee overview in a semantic main region', () => {
  renderDashboard();

  const main = screen.getByRole('main');
  expect(within(main).getByRole('heading', {
    level: 1,
    name: 'Assalam-o-Alaikum, Ayesha',
  })).toBeInTheDocument();
  expect(within(main).getByText('STP-50-014')).toBeInTheDocument();
  expect(within(main).getByText('Specialised Training Programme')).toBeInTheDocument();

  [
    'Upcoming sessions',
    'My courses',
    'My progress',
    'My attendance',
    'Feedback to fill',
    'Upcoming holidays',
    'My certificates',
  ].forEach(name => {
    expect(within(main).getByRole('region', { name })).toBeInTheDocument();
  });

  expect(within(main).getByText('Results not published yet')).toBeInTheDocument();
  expect(within(main).getByText('Programme Completion Certificate')).toBeInTheDocument();
});

it('exposes programme, course, and attendance progress to assistive technology', () => {
  renderDashboard();

  expect(screen.getByRole('progressbar', {
    name: 'Programme timeline: 53% complete',
  })).toHaveAttribute('aria-valuenow', '53');
  expect(screen.getByRole('progressbar', {
    name: 'My attendance: 86% complete',
  })).toHaveAttribute('aria-valuenow', '86');

  const courseProgress = screen.getAllByRole('progressbar', {
    name: 'Income Tax Law & Practice: 100% complete',
  });
  expect(courseProgress).toHaveLength(2);
  courseProgress.forEach(progressbar => {
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
  });
});

it('keeps preview-only actions visibly disabled', () => {
  renderDashboard();

  expect(screen.getByRole('button', { name: 'View details' })).toBeDisabled();

  const feedbackButtons = screen.getAllByRole('button', { name: 'Give feedback' });
  expect(feedbackButtons).toHaveLength(3);
  feedbackButtons.forEach(button => expect(button).toBeDisabled());

  const downloadButtons = screen.getAllByRole('button', { name: 'Download certificate' });
  expect(downloadButtons).toHaveLength(2);
  downloadButtons.forEach(button => expect(button).toBeDisabled());
});
