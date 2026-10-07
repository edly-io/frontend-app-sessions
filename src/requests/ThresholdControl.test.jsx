import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import ThresholdControl from './ThresholdControl';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const wrap = (props = {}) => {
  const onChange = jest.fn();
  render(
    <IntlProvider locale="en" messages={{}}>
      <ThresholdControl value={7} onChange={onChange} {...props} />
    </IntlProvider>,
  );
  return onChange;
};

describe('ThresholdControl', () => {
  it('renders the value in a labelled number field', () => {
    wrap();
    expect(screen.getByLabelText(/leave threshold/i)).toHaveValue(7);
  });

  it('increments with the + button', () => {
    const onChange = wrap();
    fireEvent.click(screen.getByRole('button', { name: /increase threshold/i }));
    expect(onChange).toHaveBeenCalledWith(8);
  });

  it('decrements with the − button', () => {
    const onChange = wrap();
    fireEvent.click(screen.getByRole('button', { name: /decrease threshold/i }));
    expect(onChange).toHaveBeenCalledWith(6);
  });

  it('disables − at the minimum', () => {
    wrap({ value: 0 });
    expect(screen.getByRole('button', { name: /decrease threshold/i })).toBeDisabled();
  });

  it('reports typed values as numbers', () => {
    const onChange = wrap();
    fireEvent.change(screen.getByLabelText(/leave threshold/i), { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith(12);
  });
});
