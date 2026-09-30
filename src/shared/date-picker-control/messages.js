import { defineMessages } from '@edx/frontend-platform/i18n';

const messages = defineMessages({
  calendarAltText: {
    id: 'sessions.datepickerControl.calendarAltText',
    defaultMessage: 'Calendar for datepicker input',
    description: 'Alt text for the decorative calendar icon shown inside a date input.',
  },
  clockAltText: {
    id: 'sessions.datepickerControl.clockAltText',
    defaultMessage: 'Clock for time input',
    description: 'Alt text for the decorative clock icon shown inside a time input.',
  },
  timePlaceholder: {
    id: 'sessions.datepickerControl.timePlaceholder',
    defaultMessage: '--:-- --',
    description: 'Placeholder shown in an empty time input; mirrors the browser\'s native empty time field.',
  },
  timeCaption: {
    id: 'sessions.datepickerControl.timeCaption',
    defaultMessage: 'Time',
    description: 'Heading shown above the list of selectable times in the time picker.',
  },
  previousMonthAriaLabel: {
    id: 'sessions.datepickerControl.previousMonthAriaLabel',
    defaultMessage: 'Previous month',
    description: 'Accessible label for the calendar navigation control that moves to the previous month.',
  },
  nextMonthAriaLabel: {
    id: 'sessions.datepickerControl.nextMonthAriaLabel',
    defaultMessage: 'Next month',
    description: 'Accessible label for the calendar navigation control that moves to the next month.',
  },
  previousYearAriaLabel: {
    id: 'sessions.datepickerControl.previousYearAriaLabel',
    defaultMessage: 'Previous year',
    description: 'Accessible label for the calendar navigation control that moves to the previous year.',
  },
  nextYearAriaLabel: {
    id: 'sessions.datepickerControl.nextYearAriaLabel',
    defaultMessage: 'Next year',
    description: 'Accessible label for the calendar navigation control that moves to the next year.',
  },
  monthAriaLabelPrefix: {
    id: 'sessions.datepickerControl.monthAriaLabelPrefix',
    defaultMessage: 'month',
    description: 'Prefix read out before the month name by screen readers, e.g. "month: September".',
  },
  chooseDayAriaLabelPrefix: {
    id: 'sessions.datepickerControl.chooseDayAriaLabelPrefix',
    defaultMessage: 'Choose',
    description: 'Prefix read out before a selectable day, e.g. "Choose Tuesday, September 1st, 2026".',
  },
  disabledDayAriaLabelPrefix: {
    id: 'sessions.datepickerControl.disabledDayAriaLabelPrefix',
    defaultMessage: 'Not available',
    description: 'Prefix read out before a day that is outside the allowed min/max range.',
  },
});

export default messages;
