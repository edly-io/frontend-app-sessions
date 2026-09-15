import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';

import MyFeedbackSummaryCard from './MyFeedbackSummaryCard';

const mockUsePendingFeedback = jest.fn();
const mockUseFeedback = jest.fn();

jest.mock('./usePendingFeedback', () => (...args) => mockUsePendingFeedback(...args));
jest.mock('../dashboard/useFeedback', () => (...args) => mockUseFeedback(...args));
jest.mock('../dashboard/FeedbackFormModal', () => {
  // eslint-disable-next-line react/prop-types
  const MockFeedbackFormModal = ({ isOpen }) => (
    isOpen ? <div role="dialog" aria-label="Feedback form">Feedback form</div> : null
  );
  return MockFeedbackFormModal;
});

const pendingFeedback = [{
  id: 91,
  feedback_name: 'Leadership feedback',
  form_name: 'Leadership review',
  subject_name: 'Ayesha Khan',
  program_name: 'Advanced Leadership Programme',
  course_id: '',
  deadline: '2026-09-30',
  status: 'Pending',
}];

const renderCard = () => render(
  <IntlProvider locale="en" messages={{}}>
    <MyFeedbackSummaryCard />
  </IntlProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  mockUsePendingFeedback.mockReturnValue({
    data: pendingFeedback,
    isLoading: false,
    isError: false,
  });
  mockUseFeedback.mockImplementation(requestId => ({
    feedback: requestId === null ? null : pendingFeedback[0],
    isLoading: false,
    loadError: null,
    submit: jest.fn(),
  }));
});

it('shows pending feedback in a modal and opens the selected form', async () => {
  const user = userEvent.setup();
  renderCard();

  expect(screen.getByText('1 pending form')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'View feedback' }));

  expect(screen.getByRole('dialog', { name: 'Feedback to fill' })).toBeInTheDocument();
  expect(screen.getByText('Leadership feedback')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Fill feedback' }));

  expect(screen.queryByRole('dialog', { name: 'Feedback to fill' })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Feedback form' })).toBeInTheDocument();
  expect(mockUseFeedback).toHaveBeenLastCalledWith(91);
});

it('hides the entire feedback section when there is no pending feedback', () => {
  mockUsePendingFeedback.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
  });

  renderCard();

  expect(screen.queryByText('Feedback to fill')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'View feedback' })).not.toBeInTheDocument();
});
