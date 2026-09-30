import React from 'react';
import {
  render, fireEvent, screen, waitFor,
} from '@testing-library/react';
import { IntlProvider } from '@edx/frontend-platform/i18n';

import DatepickerControl, { DATEPICKER_DISPLAY_FORMAT, DATEPICKER_TYPES } from './DatepickerControl';
import messages from './messages';

const renderControl = (props = {}) => render(
  <IntlProvider locale="en">
    <DatepickerControl onChange={jest.fn()} {...props} />
  </IntlProvider>,
);

// Flushes the component's lazy locale-load effect so it stays inside `act`.
const flushLocaleLoad = () => waitFor(() => {});

describe('<DatepickerControl /> (date)', () => {
  const groupProps = {
    label: 'Start date', helpText: 'Pick a day', controlName: 'start-date', renderGroup: true,
  };

  it('renders the label, help text and the DD/MM/YYYY placeholder in group mode', async () => {
    renderControl(groupProps);
    await flushLocaleLoad();
    expect(screen.getByText('Start date')).toBeInTheDocument();
    expect(screen.getByText('Pick a day')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(DATEPICKER_DISPLAY_FORMAT.toUpperCase())).toBeInTheDocument();
  });

  it('displays a stored yyyy-MM-dd value as DD/MM/YYYY', async () => {
    renderControl({ ...groupProps, value: '2026-09-15' });
    await flushLocaleLoad();
    expect(screen.getByLabelText('Start date').value).toBe('15/09/2026');
  });

  it('reports a typed DD/MM/YYYY date as yyyy-MM-dd', async () => {
    const onChange = jest.fn();
    renderControl({ ...groupProps, onChange });
    await flushLocaleLoad();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '16/09/2026' } });
    expect(onChange).toHaveBeenCalledWith('2026-09-16');
  });

  it('ignores a partially typed date', async () => {
    const onChange = jest.fn();
    renderControl({ ...groupProps, onChange });
    await flushLocaleLoad();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '16/0' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('still reports a typed date outside min/max so the caller can validate it', async () => {
    const onChange = jest.fn();
    renderControl({ ...groupProps, onChange, maxDate: '2026-09-20' });
    await flushLocaleLoad();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '25/09/2026' } });
    expect(onChange).toHaveBeenCalledWith('2026-09-25');
  });

  it('reports an empty string when cleared', async () => {
    const onChange = jest.fn();
    renderControl({ ...groupProps, onChange, value: '2026-09-15' });
    await flushLocaleLoad();
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('selects a clicked day', async () => {
    const onChange = jest.fn();
    renderControl({ ...groupProps, onChange, value: '2026-09-15' });
    await flushLocaleLoad();
    fireEvent.focus(screen.getByLabelText('Start date'));
    const day20 = screen.getAllByText('20', { selector: '.react-datepicker__day' })
      .find((day) => !day.className.includes('outside-month'));
    fireEvent.click(day20);
    expect(onChange).toHaveBeenCalledWith('2026-09-20');
  });

  it('disables days outside minDate/maxDate', async () => {
    renderControl({
      ...groupProps, value: '2026-09-15', minDate: '2026-09-10', maxDate: '2026-09-20',
    });
    await flushLocaleLoad();
    fireEvent.focus(screen.getByLabelText('Start date'));
    expect(screen.getByLabelText('Not available Tuesday, September 1st, 2026')).toHaveClass('react-datepicker__day--disabled');
    expect(screen.getByLabelText('Not available Friday, September 25th, 2026')).toHaveClass('react-datepicker__day--disabled');
    expect(screen.getByLabelText('Choose Tuesday, September 15th, 2026')).not.toHaveClass('react-datepicker__day--disabled');
  });

  it('exposes translated labels for the calendar navigation', async () => {
    renderControl(groupProps);
    await flushLocaleLoad();
    fireEvent.focus(screen.getByLabelText('Start date'));
    expect(screen.getByLabelText(messages.previousMonthAriaLabel.defaultMessage)).toBeInTheDocument();
    expect(screen.getByLabelText(messages.nextMonthAriaLabel.defaultMessage)).toBeInTheDocument();
  });

  it('marks an invalid, required field and links its help text', async () => {
    renderControl({ ...groupProps, isInvalid: true, required: true });
    await flushLocaleLoad();
    const input = screen.getByLabelText('Start date');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveClass('is-invalid');
    expect(input).toHaveAttribute('aria-describedby', 'start-date-help-text');
  });

  it('disables the input and hides the icon when readonly', async () => {
    const { container } = renderControl({ ...groupProps, readonly: true });
    await flushLocaleLoad();
    expect(screen.getByLabelText('Start date')).toBeDisabled();
    expect(container.querySelector('.datepicker-custom-control-icon')).not.toBeInTheDocument();
  });

  it('renders bare by default, with className on the wrapper and ariaLabel/dataTestId on the input', async () => {
    const { container } = renderControl({ ariaLabel: 'From', dataTestId: 'from-date', className: 'my-field' });
    await flushLocaleLoad();
    expect(container.querySelector('.pgn__form-group')).not.toBeInTheDocument();
    expect(container.firstChild).toHaveClass('datepicker-control', 'my-field');
    expect(screen.getByLabelText('From')).toHaveAttribute('data-testid', 'from-date');
  });

  it('applies the small size to the input', async () => {
    renderControl({ ariaLabel: 'Ends on', size: 'sm' });
    await flushLocaleLoad();
    expect(screen.getByLabelText('Ends on')).toHaveClass('form-control-sm');
  });
});

describe('<DatepickerControl type="time" />', () => {
  const timeProps = { type: DATEPICKER_TYPES.time, ariaLabel: 'Start time' };

  it('displays a stored HH:mm value in 12-hour form', async () => {
    renderControl({ ...timeProps, value: '14:30' });
    await flushLocaleLoad();
    expect(screen.getByLabelText('Start time').value).toBe('02:30 PM');
  });

  it('shows the time placeholder', async () => {
    renderControl(timeProps);
    await flushLocaleLoad();
    expect(screen.getByPlaceholderText(messages.timePlaceholder.defaultMessage)).toBeInTheDocument();
  });

  it.each([
    ['09:30 AM', '09:30'],
    ['9:30 pm', '21:30'],
    ['21:30', '21:30'],
    ['7:05', '07:05'],
  ])('reports typed "%s" as %s', async (typed, expected) => {
    const onChange = jest.fn();
    renderControl({ ...timeProps, onChange });
    await flushLocaleLoad();
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: typed } });
    expect(onChange).toHaveBeenCalledWith(expected);
  });

  it('ignores a partially typed time', async () => {
    const onChange = jest.fn();
    renderControl({ ...timeProps, onChange });
    await flushLocaleLoad();
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '9:3' } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('lists times at the configured interval and reports a picked one as HH:mm', async () => {
    const onChange = jest.fn();
    renderControl({ ...timeProps, onChange, timeIntervals: 30 });
    await flushLocaleLoad();
    fireEvent.focus(screen.getByLabelText('Start time'));
    expect(screen.getByText(messages.timeCaption.defaultMessage)).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(48);
    fireEvent.click(screen.getByText('01:30 PM', { selector: '.react-datepicker__time-list-item' }));
    expect(onChange).toHaveBeenCalledWith('13:30');
  });

  it('uses the clock icon', async () => {
    const { container } = renderControl(timeProps);
    await flushLocaleLoad();
    expect(container.querySelector('.datepicker-custom-control-icon'))
      .toHaveAttribute('alt', messages.clockAltText.defaultMessage);
  });
});
