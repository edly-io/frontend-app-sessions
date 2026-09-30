import React, { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { format, parse, isValid as isValidDateFns } from 'date-fns';
import { Form, Icon } from '@openedx/paragon';
import { AccessTime, Calendar } from '@openedx/paragon/icons';
import { useIntl } from '@edx/frontend-platform/i18n';

import { getDateFnsLocale } from './dateFnsLocale';
import messages from './messages';

export const DATEPICKER_TYPES = {
  date: 'date',
  time: 'time',
};

// Values keep the shape a native <input type="date"> / <input type="time"> produced,
// so callers' state and API payloads are unchanged.
export const DATEPICKER_VALUE_FORMAT = 'yyyy-MM-dd';
export const DATEPICKER_DISPLAY_FORMAT = 'dd/MM/yyyy';
export const TIMEPICKER_VALUE_FORMAT = 'HH:mm';
export const TIMEPICKER_DISPLAY_FORMAT = 'hh:mm aa';

// Typed times are accepted in 12-hour ("09:30 AM", "9:30 pm") or 24-hour ("21:30") form.
const TIME_INPUT_FORMATS = [TIMEPICKER_DISPLAY_FORMAT, 'h:mm aa', TIMEPICKER_VALUE_FORMAT, 'H:mm'];

const isValidJsDate = (date) => date instanceof Date && !Number.isNaN(date.getTime());

const parseValue = (value, valueFormat) => {
  if (!value) {
    return null;
  }
  const parsed = parse(value, valueFormat, new Date());
  return isValidDateFns(parsed) ? parsed : null;
};

const formatValue = (date, valueFormat) => (isValidJsDate(date) ? format(date, valueFormat) : '');

// Only a fully-typed value counts; partial input ("1", "12/0") is ignored until complete.
const parseTypedValue = (rawValue, inputFormats) => {
  const text = rawValue.trim().toLowerCase();
  for (let i = 0; i < inputFormats.length; i += 1) {
    const parsed = parse(text, inputFormats[i], new Date());
    if (isValidDateFns(parsed) && format(parsed, inputFormats[i]).toLowerCase() === text) {
      return parsed;
    }
  }
  return null;
};

const DatepickerControl = ({
  type,
  label,
  ariaLabel,
  value,
  onChange,
  id,
  controlName,
  valueFormat,
  displayFormat,
  minDate,
  maxDate,
  timeIntervals,
  placeholder,
  isInvalid,
  helpText,
  readonly,
  required,
  size,
  dataTestId,
  onBlur,
  onFocus,
  renderGroup,
  formGroupClassName,
  className,
  inputClassName,
}) => {
  const intl = useIntl();
  const isTime = type === DATEPICKER_TYPES.time;
  const resolvedValueFormat = valueFormat || (isTime ? TIMEPICKER_VALUE_FORMAT : DATEPICKER_VALUE_FORMAT);
  const resolvedDisplayFormat = displayFormat || (isTime ? TIMEPICKER_DISPLAY_FORMAT : DATEPICKER_DISPLAY_FORMAT);
  const inputFormats = isTime ? [resolvedDisplayFormat, ...TIME_INPUT_FORMATS] : [resolvedDisplayFormat];

  // Lazily-loaded date-fns locale for react-datepicker's `locale` prop; skipped for English.
  const [locale, setLocale] = useState(undefined);
  const isEnglish = intl.locale?.toLowerCase().startsWith('en');

  useEffect(() => {
    if (isEnglish) {
      return undefined;
    }
    let isMounted = true;
    getDateFnsLocale(intl.locale).then((loadedLocale) => {
      if (isMounted) {
        setLocale(loadedLocale);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [intl.locale, isEnglish]);

  const inputId = id || controlName || undefined;
  const helpTextId = helpText && inputId ? `${inputId}-help-text` : undefined;

  const selected = parseValue(value, resolvedValueFormat);

  // react-datepicker doesn't forward arbitrary props (like `data-testid` or `aria-label`)
  // to its own <input>, so they're carried through `customInput`.
  const extraInputProps = {};
  if (dataTestId) {
    extraInputProps['data-testid'] = dataTestId;
  }
  if (ariaLabel) {
    extraInputProps['aria-label'] = ariaLabel;
  }
  const customInput = Object.keys(extraInputProps).length > 0 ? <input {...extraInputProps} /> : undefined;

  const handleChange = (date) => {
    if (isValidJsDate(date)) {
      onChange(formatValue(date, resolvedValueFormat));
    } else if (date === null) {
      onChange('');
    }
  };

  // react-datepicker's own `onChange` silently drops a typed date outside minDate/maxDate.
  // Parsing the raw text keeps the native input's contract: any fully-typed value reaches
  // `onChange`, and the caller's own validation decides what to do with it.
  const handleChangeRaw = (event) => {
    const rawValue = event?.target?.value;
    if (typeof rawValue !== 'string') {
      return;
    }
    if (rawValue === '') {
      onChange('');
      return;
    }
    const parsed = parseTypedValue(rawValue, inputFormats);
    if (parsed) {
      onChange(formatValue(parsed, resolvedValueFormat));
    }
  };

  const datepickerNode = (
    <div className={classNames('datepicker-control', className, { 'datepicker-control--sm': size === 'sm' })}>
      {!readonly && (
        <Icon
          src={isTime ? AccessTime : Calendar}
          className="datepicker-custom-control-icon"
          alt={intl.formatMessage(isTime ? messages.clockAltText : messages.calendarAltText)}
        />
      )}
      <DatePicker
        id={inputId}
        name={controlName || undefined}
        selected={selected}
        disabled={readonly}
        dateFormat={resolvedDisplayFormat}
        timeFormat={isTime ? resolvedDisplayFormat : undefined}
        showTimeSelect={isTime}
        showTimeSelectOnly={isTime}
        timeIntervals={timeIntervals}
        timeCaption={intl.formatMessage(messages.timeCaption)}
        className={classNames('form-control datepicker-custom-control', inputClassName, {
          'form-control-sm': size === 'sm',
          'is-invalid': isInvalid,
        })}
        autoComplete="off"
        placeholderText={placeholder
          || (isTime ? intl.formatMessage(messages.timePlaceholder) : resolvedDisplayFormat.toUpperCase())}
        showPopperArrow={false}
        popperPlacement="bottom-start"
        // Fixed positioning lets the popup escape overflow containers such as modals.
        popperProps={{ strategy: 'fixed' }}
        strictParsing
        minDate={isTime ? undefined : parseValue(minDate, resolvedValueFormat)}
        maxDate={isTime ? undefined : parseValue(maxDate, resolvedValueFormat)}
        locale={locale}
        required={required}
        ariaInvalid={isInvalid ? 'true' : undefined}
        ariaRequired={required ? 'true' : undefined}
        ariaDescribedBy={helpTextId}
        customInput={customInput}
        previousMonthAriaLabel={intl.formatMessage(messages.previousMonthAriaLabel)}
        nextMonthAriaLabel={intl.formatMessage(messages.nextMonthAriaLabel)}
        previousYearAriaLabel={intl.formatMessage(messages.previousYearAriaLabel)}
        nextYearAriaLabel={intl.formatMessage(messages.nextYearAriaLabel)}
        monthAriaLabelPrefix={intl.formatMessage(messages.monthAriaLabelPrefix)}
        chooseDayAriaLabelPrefix={intl.formatMessage(messages.chooseDayAriaLabelPrefix)}
        disabledDayAriaLabelPrefix={intl.formatMessage(messages.disabledDayAriaLabelPrefix)}
        onBlur={onBlur}
        onFocus={onFocus}
        onChange={handleChange}
        onChangeRaw={handleChangeRaw}
      />
    </div>
  );

  if (!renderGroup) {
    return datepickerNode;
  }

  return (
    <Form.Group
      controlId={inputId}
      className={classNames('datepicker-custom-group', formGroupClassName)}
    >
      <Form.Label htmlFor={inputId}>{label}</Form.Label>
      {datepickerNode}
      {helpText && <Form.Control.Feedback id={helpTextId}>{helpText}</Form.Control.Feedback>}
    </Form.Group>
  );
};

DatepickerControl.defaultProps = {
  type: DATEPICKER_TYPES.date,
  label: '',
  ariaLabel: '',
  value: '',
  id: '',
  controlName: '',
  valueFormat: '',
  displayFormat: '',
  minDate: '',
  maxDate: '',
  timeIntervals: 15,
  placeholder: '',
  isInvalid: false,
  helpText: '',
  readonly: false,
  required: false,
  size: undefined,
  dataTestId: undefined,
  onBlur: undefined,
  onFocus: undefined,
  renderGroup: false,
  formGroupClassName: '',
  className: '',
  inputClassName: '',
};

DatepickerControl.propTypes = {
  /** `date` shows a calendar; `time` shows a list of times. */
  type: PropTypes.oneOf(Object.values(DATEPICKER_TYPES)),
  label: PropTypes.string,
  ariaLabel: PropTypes.string,
  /** `yyyy-MM-dd` for dates, `HH:mm` for times (unless `valueFormat` says otherwise). */
  value: PropTypes.string,
  /** Called with the new value as a string in `valueFormat`, or `''` when cleared. */
  onChange: PropTypes.func.isRequired,
  id: PropTypes.string,
  controlName: PropTypes.string,
  valueFormat: PropTypes.string,
  displayFormat: PropTypes.string,
  minDate: PropTypes.string,
  maxDate: PropTypes.string,
  /** Minutes between the options in the time list. */
  timeIntervals: PropTypes.number,
  placeholder: PropTypes.string,
  isInvalid: PropTypes.bool,
  helpText: PropTypes.string,
  readonly: PropTypes.bool,
  required: PropTypes.bool,
  size: PropTypes.oneOf(['sm']),
  dataTestId: PropTypes.string,
  onBlur: PropTypes.func,
  onFocus: PropTypes.func,
  /** Wrap in a `Form.Group` with `label` and `helpText`. */
  renderGroup: PropTypes.bool,
  formGroupClassName: PropTypes.string,
  /** Applied to the control's outer wrapper, which is what a flex/grid layout sizes. */
  className: PropTypes.string,
  /** Applied to the <input> itself. */
  inputClassName: PropTypes.string,
};

export default DatepickerControl;
