import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import ThresholdControl from './ThresholdControl';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('../app/api', () => ({
  updateProgram: jest.fn(),
}));

const { updateProgram } = require('../app/api');

const wrap = (props = {}) => render(
  <IntlProvider locale="en" messages={{}}>
    <ThresholdControl
      programKey="prog1"
      initialThreshold={7}
      onUpdate={jest.fn()}
      {...props}
    />
  </IntlProvider>,
);

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload: jest.fn() },
  });
});

describe('ThresholdControl', () => {
  it('renders the initial threshold value', () => {
    wrap();
    expect(screen.getByRole('spinbutton')).toHaveValue(7);
  });

  it('Save button is disabled when value equals initial', () => {
    wrap();
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('Save button enables after changing value', () => {
    wrap();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls updateProgram with new threshold on save', async () => {
    updateProgram.mockResolvedValue({ threshold: 10 });
    wrap();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(updateProgram).toHaveBeenCalledWith('prog1', { threshold: 10 }));
  });

  it('shows Saved confirmation after successful save', async () => {
    updateProgram.mockResolvedValue({ threshold: 10 });
    wrap();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('shows error message on API failure', async () => {
    updateProgram.mockRejectedValue(new Error('Network error'));
    wrap();
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.getByText(/failed to save/i)).toBeInTheDocument());
  });
});
