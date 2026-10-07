import React from 'react';
import {
  render, screen, fireEvent, waitFor,
} from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import LeaveSettingsModal from './LeaveSettingsModal';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

jest.mock('../app/api', () => ({
  getProgram: jest.fn(),
  updateProgram: jest.fn(),
}));

const { getProgram, updateProgram } = require('../app/api');

const openModal = async () => {
  render(
    <IntlProvider locale="en" messages={{}}>
      <LeaveSettingsModal programKey="prog1" />
    </IntlProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /leave settings/i }));
  return screen.findByLabelText(/leave threshold/i);
};

beforeEach(() => {
  jest.clearAllMocks();
  getProgram.mockResolvedValue({ threshold: 7 });
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload: jest.fn() },
  });
});

describe('LeaveSettingsModal', () => {
  it('loads the current threshold when opened', async () => {
    const input = await openModal();
    expect(getProgram).toHaveBeenCalledWith('prog1');
    expect(input).toHaveValue(7);
  });

  it('keeps Save disabled until the value changes', async () => {
    await openModal();
    const save = screen.getByRole('button', { name: /^save$/i });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /increase threshold/i }));
    expect(save).not.toBeDisabled();
  });

  it('saves the new threshold and reloads', async () => {
    updateProgram.mockResolvedValue({ threshold: 10 });
    const input = await openModal();
    fireEvent.change(input, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateProgram).toHaveBeenCalledWith('prog1', { threshold: 10 }));
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled());
  });

  it('shows an error when saving fails', async () => {
    updateProgram.mockRejectedValue(new Error('Network error'));
    const input = await openModal();
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument();
  });
});
