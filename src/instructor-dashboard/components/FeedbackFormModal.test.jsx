import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';

import FeedbackFormModal from './FeedbackFormModal';

const feedback = {
  id: 602,
  feedback_name: 'Faculty evaluation',
  form_name: 'Faculty Evaluation Form',
  subject_name: 'Ifrah Saleem',
  program_name: '50th STP',
  questions: [
    {
      id: 11,
      question: 'How effective was the session?',
      question_type: 'star_rating',
      required: true,
    },
    {
      id: 12,
      question: 'What could be improved?',
      question_type: 'textarea',
      required: true,
    },
  ],
};

const renderModal = (props = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <FeedbackFormModal
      isOpen
      feedback={feedback}
      isLoading={false}
      loadError={null}
      onClose={jest.fn()}
      onSubmit={jest.fn()}
      {...props}
    />
  </IntlProvider>,
);

it('validates required questions and submits the backend answer shape', async () => {
  const user = userEvent.setup();
  const onSubmit = jest.fn().mockResolvedValue({});
  renderModal({ onSubmit });

  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));
  expect(screen.getAllByText('This question is required.')).toHaveLength(2);
  expect(onSubmit).not.toHaveBeenCalled();

  await user.click(screen.getByRole('radio', { name: '4 stars' }));
  await user.type(screen.getByRole('textbox', { name: /What could be improved/ }), 'More worked examples.');
  await user.click(screen.getByRole('button', { name: 'Submit feedback' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(602, {
    answers: [
      { question_id: 11, star_value: 4 },
      { question_id: 12, text_value: 'More worked examples.' },
    ],
  }));
  expect(await screen.findByText('Feedback submitted')).toBeInTheDocument();
});

it('shows detail-loading and detail-error states without enabling submission', () => {
  const { rerender } = renderModal({ feedback: null, isLoading: true });

  expect(screen.getByText('Loading feedback form')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Submit feedback' })).toBeDisabled();

  rerender(
    <IntlProvider locale="en" messages={{}}>
      <FeedbackFormModal
        isOpen
        feedback={null}
        isLoading={false}
        loadError="The feedback form is unavailable."
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />
    </IntlProvider>,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('The feedback form is unavailable.');
  expect(screen.getByRole('button', { name: 'Submit feedback' })).toBeDisabled();
});
