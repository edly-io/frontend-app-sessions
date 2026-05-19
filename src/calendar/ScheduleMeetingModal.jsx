import React, {
  useState, useRef, useEffect, useMemo,
} from 'react';
import PropTypes from 'prop-types';
import {
  StandardModal, Button, Form, Spinner, Alert, OverlayTrigger, Tooltip,
} from '@openedx/paragon';
import {
  correctSession, createSession, updateSession, fetchAllInstructors, fetchCourseRuns, fetchInstructors,
  getSessionsConfig,
} from './api';
import { getLocations } from '../locations/api';
import { toISOString, toDateTimeLocal, extractApiError } from '../shared/utils';
import SearchableSelect from '../shared/SearchableSelect';

// ─── Recurrence constants ─────────────────────────────────────────────────────

const RECURRENCE_TYPES = [
  { value: 'daily', label: 'day' },
  { value: 'weekly', label: 'week' },
  { value: 'monthly', label: 'month' },
];

// Sun–Sat weekday buttons — Zoom weekday numbers (Sun=1 … Sat=7)
const ALL_WEEK_DAYS = [
  { value: 1, letter: 'S', fullName: 'Sunday' },
  { value: 2, letter: 'M', fullName: 'Monday' },
  { value: 3, letter: 'T', fullName: 'Tuesday' },
  { value: 4, letter: 'W', fullName: 'Wednesday' },
  { value: 5, letter: 'T', fullName: 'Thursday' },
  { value: 6, letter: 'F', fullName: 'Friday' },
  { value: 7, letter: 'S', fullName: 'Saturday' },
];

const MONTHLY_WEEKS = [
  { value: 1, label: 'First' },
  { value: 2, label: 'Second' },
  { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' },
  { value: -1, label: 'Last' },
];

// ─── Recurrence limits ────────────────────────────────────────────────────────

const MAX_END_COUNT = 30; // We cap at 30; Zoom's absolute hard limit is 60
const MAX_END_MONTHS = 2; // End date can be at most 2 months from session start

/** Returns the ISO date string (YYYY-MM-DD) that is MAX_END_MONTHS months after startDateString. */
const getMaxEndDate = (startDateString) => {
  if (!startDateString) { return ''; }
  const d = new Date(startDateString);
  d.setMonth(d.getMonth() + MAX_END_MONTHS);
  return d.toISOString().slice(0, 10);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the Zoom weekday number (1=Sun … 7=Sat) for a datetime-local string. */
const getZoomWeekdayFromDate = (dateString) => {
  if (!dateString) { return 2; }
  return new Date(dateString).getDay() + 1; // JS 0-based → Zoom 1-based (1=Sun … 7=Sat)
};

/** Returns the day-of-month (1–31) from a datetime-local string. */
const getMonthDayFromDate = (dateString) => {
  if (!dateString) { return 1; }
  return new Date(dateString).getDate();
};

/** Returns which week-of-month the date falls on (1–4). */
const getMonthWeekFromDate = (dateString) => {
  if (!dateString) { return 1; }
  return Math.min(4, Math.ceil(new Date(dateString).getDate() / 7));
};

const getLocalDateString = (isoString) => {
  if (!isoString) { return ''; }
  return new Date(isoString).toISOString().slice(0, 10);
};

const splitDateTimeLocal = (dateTimeLocalString) => {
  if (!dateTimeLocalString) { return { date: '', time: '' }; }
  const [date, time] = dateTimeLocalString.split('T');
  return { date: date || '', time: (time || '').slice(0, 5) };
};

const combineDateTimeLocal = (date, time) => (date && time ? `${date}T${time}` : '');

/** Builds a human-readable summary shown below the recurrence panel. */
const buildSummary = ({
  recurrenceType, weeklyDays, monthlyMode, monthlyDay, monthlyWeek, monthlyWeekDay, endType, endCount, endDate,
}) => {
  const dayName = (v) => ALL_WEEK_DAYS.find((d) => d.value === v)?.fullName ?? '';
  const weekLabel = (v) => MONTHLY_WEEKS.find((w) => w.value === v)?.label ?? '';

  let pattern = '';
  if (recurrenceType === 'daily') {
    pattern = 'Every day';
  } else if (recurrenceType === 'weekly') {
    if (!weeklyDays.length) { return ''; }
    const names = weeklyDays.map(dayName).filter(Boolean);
    pattern = `Every ${names.join(' and ')}`;
  } else if (recurrenceType === 'monthly') {
    if (monthlyMode === 'day') {
      pattern = `Day ${monthlyDay} of every month`;
    } else {
      pattern = `${weekLabel(monthlyWeek)} ${dayName(monthlyWeekDay)} of every month`;
    }
  }

  if (!pattern) { return ''; }
  if (endType === 'count') { return `${pattern} • ${endCount} session${endCount !== 1 ? 's' : ''}`; }
  if (endType === 'date' && endDate) {
    const formatted = new Date(`${endDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${pattern} • until ${formatted}`;
  }
  return pattern;
};

const ScheduleMeetingModal = ({
  isOpen, onClose, programKey, onSuccess, session, holidays,
}) => {
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // A past session opens in correction mode: only course, instructor, and
  // location fields are editable. Uses scheduled_end_time so in-progress
  // sessions are not incorrectly treated as past (consistent with CalendarView).
  const isPastSession = !!session && new Date(session.scheduled_end_time || session.scheduled_start_time) <= new Date();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef(null);
  const conflictRef = useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
  });
  // When off, the session is in-person/manual. Remote learners request personal
  // Zoom links through the session-request approval flow instead. Field is
  // captured on create only; backend makes it read-only on updates.
  const [createZoomMeeting, setCreateZoomMeeting] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('weekly');
  const [weeklyDays, setWeeklyDays] = useState([2]);
  const [monthlyMode, setMonthlyMode] = useState('day');
  const [monthlyDay, setMonthlyDay] = useState(1);
  const [monthlyWeek, setMonthlyWeek] = useState(1);
  const [monthlyWeekDay, setMonthlyWeekDay] = useState(2);
  const [endType, setEndType] = useState('count');
  const [endCount, setEndCount] = useState(10);
  const [endDate, setEndDate] = useState('');
  const [startDateInput, setStartDateInput] = useState('');
  const [startTimeInput, setStartTimeInput] = useState('');
  const [endDateInput, setEndDateInput] = useState('');
  const [endTimeInput, setEndTimeInput] = useState('');

  // ─── Course run & instructor ───────────────────────────────────────────────
  const [courseRunOptions, setCourseRunOptions] = useState([]);
  const [instructorOptions, setInstructorOptions] = useState([]);
  const [selectedCourseRun, setSelectedCourseRun] = useState(null);
  const [selectedInstructors, setSelectedInstructors] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [courseRunsLoading, setCourseRunsLoading] = useState(false);
  const [instructorsLoading, setInstructorsLoading] = useState(false);
  const [sessionType, setSessionType] = useState('session');
  const [sessionTypeOptions, setSessionTypeOptions] = useState([]);
  const isSessionType = sessionType === 'session';

  // Conflict detection — set when the API returns HTTP 409.
  const [conflictData, setConflictData] = useState(null);
  const [pendingPayload, setPendingPayload] = useState(null);

  // Which fields to highlight red, derived from the active conflict type.
  const fieldErrors = useMemo(() => {
    if (!conflictData) { return {}; }
    switch (conflictData.conflict_type) {
      case 'INSTRUCTOR_DOUBLE_BOOKING': return { instructors: true };
      case 'ROOM_DOUBLE_BOOKING': return { location: true };
      case 'TRAINEE_CLASH': return { startTime: true, endTime: true };
      case 'PROTECTED_DATE': return { startDate: true };
      default: return {};
    }
  }, [conflictData]);

  useEffect(() => {
    if (conflictData) {
      setTimeout(() => conflictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
  }, [conflictData]);

  // Soft scheduling warning — shown when the selected start date is a weekend
  // or a public holiday. Does not block form submission.
  const schedulingWarning = useMemo(() => {
    if (!startDateInput || isPastSession) { return ''; }
    const d = new Date(`${startDateInput}T00:00:00`);
    const dow = d.getDay(); // 0 = Sunday, 6 = Saturday
    if (dow === 0 || dow === 6) {
      return `${dow === 0 ? 'Sunday' : 'Saturday'} is a weekend day. You can still schedule this session.`;
    }
    const holidayMatch = holidays.find(
      (h) => h.start_date <= startDateInput && startDateInput <= h.end_date,
    );
    if (holidayMatch) {
      return `${holidayMatch.name} is a public holiday on this date. You can still schedule this session.`;
    }
    return '';
  }, [startDateInput, holidays, isPastSession]);

  // Fetch the full course run list once each time the modal opens
  useEffect(() => {
    if (!isOpen) { return; }
    setCourseRunsLoading(true);
    fetchCourseRuns()
      .then((data) => setCourseRunOptions(data.map((r) => ({ value: r.id, label: r.title }))))
      .catch(() => {}) // silently fail — modal remains usable
      .finally(() => setCourseRunsLoading(false));
  }, [isOpen]);

  // Fetch the locations catalogue when the modal opens.
  useEffect(() => {
    if (!isOpen) { return; }
    setLocationsLoading(true);
    getLocations()
      .then((data) => setLocationOptions(
        (data || []).map((loc) => ({ value: loc.id, label: loc.name })),
      ))
      .catch(() => {}) // silently fail — admin can still save without a location
      .finally(() => setLocationsLoading(false));
  }, [isOpen]);

  // Fetch session type options from the attendance config endpoint.
  useEffect(() => {
    if (!isOpen) { return; }
    getSessionsConfig()
      .then((cfg) => setSessionTypeOptions(cfg.session_types || []))
      .catch(() => {});
  }, [isOpen]);

  // Pre-fill course run once options are loaded (edit mode only).
  useEffect(() => {
    if (courseRunOptions.length === 0 || !session) { return; }
    const targetId = String(session.course_id);
    if (!targetId) { return; }
    const match = courseRunOptions.find((r) => r.value === targetId);
    if (match) { setSelectedCourseRun(match); }
  }, [courseRunOptions, session]);

  // Fetch instructors whenever the selected course run changes.
  // In correction mode we fetch the global instructor list once on open (the
  // course itself may be changing, so scoping to the old course is misleading).
  // In normal mode we scope the fetch to the selected course run.
  const selectedCourseRunId = selectedCourseRun?.value ?? null;
  useEffect(() => {
    if (isPastSession) {
      // Correction mode: load all instructors once; don't clear on course change.
      if (!isOpen) { return; }
      setInstructorsLoading(true);
      fetchAllInstructors()
        .then((data) => setInstructorOptions(
          data.map((i) => ({ value: i.user_id, label: i.name, email: i.email })),
        ))
        .catch(() => {})
        .finally(() => setInstructorsLoading(false));
      return;
    }
    // Normal mode: course is only required when session_type is 'session'.
    // For other types load all instructors immediately even without a course.
    if (!selectedCourseRunId && isSessionType) {
      setInstructorOptions([]);
      setSelectedInstructors([]);
      return;
    }
    setInstructorsLoading(true);
    if (!isSessionType) { setSelectedInstructors([]); }
    fetchInstructors()
      .then((data) => setInstructorOptions(
        data.map((i) => ({ value: i.user_id, label: i.name, email: i.email })),
      ))
      .catch(() => {})
      .finally(() => setInstructorsLoading(false));
  }, [isPastSession, isOpen, selectedCourseRunId, isSessionType]);

  // Pre-fill instructors once options are loaded (edit mode only).
  // Backend returns `instructor_emails` (ordered); match each to the loaded
  // instructor options and preserve order.
  useEffect(() => {
    if (!session || instructorOptions.length === 0) { return; }
    const emails = session.instructor_emails || [];
    if (emails.length === 0) { return; }
    const matched = emails
      .map((email) => instructorOptions.find((i) => i.email === email))
      .filter(Boolean);
    if (matched.length > 0) { setSelectedInstructors(matched); }
  }, [instructorOptions, session]);

  // Pre-fill form when editing
  useEffect(() => {
    if (session) {
      setSessionType(session.session_type || 'session');
      const startDateTimeLocal = toDateTimeLocal(session.scheduled_start_time) || '';
      const endDateTimeLocal = toDateTimeLocal(session.scheduled_end_time) || '';
      const { date: startDate, time: startTime } = splitDateTimeLocal(startDateTimeLocal);
      const { date: endDateValue, time: endTime } = splitDateTimeLocal(endDateTimeLocal);
      if (session.location) {
        setSelectedLocation({ value: session.location.id, label: session.location.name });
      } else {
        setSelectedLocation(null);
      }
      setFormData({
        title: session.title || '',
        description: session.description || '',
        scheduled_start_time: startDateTimeLocal,
        scheduled_end_time: endDateTimeLocal,
      });
      setStartDateInput(startDate);
      setStartTimeInput(startTime);
      setEndDateInput(endDateValue);
      setEndTimeInput(endTime);
      setCreateZoomMeeting(Boolean(session.create_zoom_meeting));
      const recurrence = session.recurrence || {};
      const hasRecurrence = session.is_recurring || Object.keys(recurrence).length > 0;
      setIsRecurring(hasRecurrence);
      if (hasRecurrence) {
        const type = recurrence.type || 2;
        // eslint-disable-next-line no-nested-ternary
        const typeLabel = type === 1 ? 'daily' : type === 3 ? 'monthly' : 'weekly';
        setRecurrenceType(typeLabel);
        if (type === 2) {
          const days = (recurrence.weekly_days || '')
            .split(',')
            .map((d) => parseInt(d, 10))
            .filter((d) => Number.isInteger(d));
          setWeeklyDays(days.length ? days : [2]);
        }
        if (type === 3) {
          if (recurrence.monthly_day) {
            setMonthlyMode('day');
            setMonthlyDay(recurrence.monthly_day);
          } else {
            setMonthlyMode('week');
            setMonthlyWeek(recurrence.monthly_week || 1);
            setMonthlyWeekDay(recurrence.monthly_week_day || 2);
          }
        }
        if (recurrence.end_times) {
          setEndType('count');
          setEndCount(recurrence.end_times);
          setEndDate('');
        } else if (recurrence.end_date_time) {
          setEndType('date');
          setEndDate(getLocalDateString(recurrence.end_date_time));
        } else {
          // Fallback: default to 10 occurrences
          setEndType('count');
          setEndCount(10);
        }
      }
    } else {
      setSessionType('session');
      setFormData({
        title: '',
        description: '',
        scheduled_start_time: '',
        scheduled_end_time: '',
      });
      setStartDateInput('');
      setStartTimeInput('');
      setEndDateInput('');
      setEndTimeInput('');
      setCreateZoomMeeting(false);
      setIsRecurring(false);
      setRecurrenceType('weekly');
      setWeeklyDays([2]);
      setMonthlyMode('day');
      setMonthlyDay(1);
      setMonthlyWeek(1);
      setMonthlyWeekDay(2);
      setEndType('count');
      setEndCount(10);
      setEndDate('');
      setSelectedCourseRun(null);
      setSelectedInstructors([]);
      setSelectedLocation(null);
      setInstructorOptions([]);
    }
  }, [session, isOpen]);

  useEffect(() => {
    const baseDateTime = formData.scheduled_start_time || (startDateInput ? `${startDateInput}T00:00` : '');
    if (!session && baseDateTime) {
      const weekday = getZoomWeekdayFromDate(baseDateTime);
      const day = getMonthDayFromDate(baseDateTime);
      setWeeklyDays([weekday]);
      setMonthlyDay(day);
      setMonthlyWeek(getMonthWeekFromDate(baseDateTime));
      setMonthlyWeekDay(weekday);
      // Day 29-31 doesn't exist in all months — force the safer weekday pattern
      if (day >= 29) { setMonthlyMode('week'); }
    }
  }, [formData.scheduled_start_time, startDateInput, session]);

  const handleChange = (e) => {
    const {
      name, value, type, checked,
    } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleStartDateChange = (e) => {
    const date = e.target.value;
    setStartDateInput(date);
    setFormData((prev) => ({
      ...prev,
      scheduled_start_time: combineDateTimeLocal(date, startTimeInput),
    }));
  };

  const handleStartTimeChange = (e) => {
    const time = e.target.value;
    setStartTimeInput(time);
    setFormData((prev) => ({
      ...prev,
      scheduled_start_time: combineDateTimeLocal(startDateInput, time),
    }));
  };

  const handleEndDateChange = (e) => {
    const date = e.target.value;
    setEndDateInput(date);
    setFormData((prev) => ({
      ...prev,
      scheduled_end_time: combineDateTimeLocal(date, endTimeInput),
    }));
  };

  const handleEndTimeChange = (e) => {
    const time = e.target.value;
    setEndTimeInput(time);
    setFormData((prev) => ({
      ...prev,
      scheduled_end_time: combineDateTimeLocal(endDateInput, time),
    }));
  };

  const validateForm = () => {
    if (!isPastSession && !formData.title.trim()) {
      setError('Title is required');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return false;
    }
    if (isSessionType && !selectedCourseRun) {
      setError('Course is required for this session type');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return false;
    }
    if (isSessionType && selectedInstructors.length === 0) {
      setError('At least one instructor is required for this session type');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return false;
    }
    if (!isPastSession && isSessionType && !selectedLocation) {
      setError('Location is required for this session type');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return false;
    }
    if (!isPastSession && !formData.scheduled_start_time) {
      setError('Start time is required');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return false;
    }
    if (!isPastSession && !formData.scheduled_end_time) {
      setError('End time is required');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return false;
    }
    if (!isPastSession && new Date(formData.scheduled_end_time) <= new Date(formData.scheduled_start_time)) {
      setError('End time must be after start time');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return false;
    }
    if (!isPastSession && new Date(formData.scheduled_start_time) <= new Date()) {
      setError('Start time must be in the future');
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      return false;
    }
    if (!isPastSession && isRecurring) {
      if (recurrenceType === 'weekly' && (!weeklyDays || weeklyDays.length === 0)) {
        setError('Select at least one weekday');
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        return false;
      }
      if (recurrenceType === 'monthly' && monthlyMode === 'day' && (!monthlyDay || monthlyDay < 1 || monthlyDay > 31)) {
        setError('Monthly day must be between 1 and 31');
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        return false;
      }
      if (endType === 'count' && (!endCount || endCount < 1)) {
        setError('End count must be at least 1');
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        return false;
      }
      if (endType === 'count' && endCount > MAX_END_COUNT) {
        setError(`Occurrences cannot exceed ${MAX_END_COUNT}.`);
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        return false;
      }
      if (endType === 'date' && !endDate) {
        setError('End date is required');
        setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
        return false;
      }
      if (endType === 'date' && endDate) {
        const startDateForRange = formData.scheduled_start_time || (startDateInput ? `${startDateInput}T00:00` : '');
        const startDateOnly = startDateForRange
          ? new Date(startDateForRange).toISOString().slice(0, 10)
          : '';
        if (startDateOnly && endDate < startDateOnly) {
          setError('End date must be after the start date');
          setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
          return false;
        }
        const maxDate = getMaxEndDate(startDateForRange);
        if (maxDate && endDate > maxDate) {
          setError(`End date cannot be more than ${MAX_END_MONTHS} months from the start date.`);
          setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
          return false;
        }
      }
    }
    return true;
  };

  const buildRecurrence = () => {
    if (!isRecurring) { return null; }
    const recurrence = { repeat_interval: 1 };
    if (recurrenceType === 'daily') {
      // type 1 = Zoom daily recurrence (every weekday when repeat_interval=1 and no weekly_days)
      recurrence.type = 1;
    } else if (recurrenceType === 'weekly') {
      recurrence.type = 2;
      recurrence.weekly_days = [...weeklyDays].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b).join(',');
    } else if (recurrenceType === 'monthly') {
      recurrence.type = 3;
      if (monthlyMode === 'day') {
        recurrence.monthly_day = monthlyDay;
      } else {
        recurrence.monthly_week = monthlyWeek;
        recurrence.monthly_week_day = monthlyWeekDay;
      }
    }
    if (endType === 'count') {
      recurrence.end_times = endCount;
    } else if (endType === 'date') {
      recurrence.end_date_time = new Date(`${endDate}T23:59:59`).toISOString();
    }
    return recurrence;
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      scheduled_start_time: '',
      scheduled_end_time: '',
    });
    setStartDateInput('');
    setStartTimeInput('');
    setEndDateInput('');
    setEndTimeInput('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setConflictData(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      let result;

      if (isPastSession) {
        // Correction mode: build a minimal diff — only include fields that
        // actually changed. validateForm() already guarantees selectedCourseRun
        // and selectedInstructors are non-empty before we reach here.
        const correctionPayload = {};
        const newCourseId = selectedCourseRun.value;
        if (newCourseId !== String(session.course_id)) {
          correctionPayload.course_id = newCourseId;
        }
        const newEmails = selectedInstructors.map((i) => i.email);
        const originalEmails = (session.instructor_emails || []).slice().sort().join(',');
        if (newEmails.slice().sort().join(',') !== originalEmails) {
          correctionPayload.instructor_emails = newEmails;
        }
        const newLocationId = selectedLocation?.value ?? null;
        const originalLocationId = session.location?.id ?? null;
        if (newLocationId !== originalLocationId) {
          correctionPayload.location_id = newLocationId;
        }
        if (!Object.keys(correctionPayload).length) {
          setError('No changes detected. Update the course, instructors, or location before saving.');
          setLoading(false);
          return;
        }
        result = await correctSession(session.id, correctionPayload);
      } else {
        // Normal mode: full scheduling edit / create.
        const recurrence = buildRecurrence();
        const sessionData = {
          program_key: programKey,
          session_type: sessionType,
          course_id: selectedCourseRun?.value || null,
          title: formData.title,
          description: formData.description,
          scheduled_start_time: toISOString(formData.scheduled_start_time),
          scheduled_end_time: toISOString(formData.scheduled_end_time),
          timezone: timezoneName,
          is_recurring: isRecurring,
          instructor_emails: selectedInstructors.map((i) => i.email),
          location_id: selectedLocation?.value || null,
          create_zoom_meeting: createZoomMeeting,
        };
        if (recurrence) {
          sessionData.recurrence = recurrence;
        }
        setPendingPayload(sessionData);
        if (session) {
          result = await updateSession(session.id, sessionData);
        } else {
          result = await createSession(sessionData);
        }
      }

      onSuccess(result);
      resetForm();
    } catch (err) {
      if (err.response?.status === 409) {
        setConflictData(err.response.data);
      } else {
        setError(extractApiError(err, 'Failed to save session. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProceedAnyway = async () => {
    setConflictData(null);
    setLoading(true);
    try {
      const acknowledgedPayload = { ...pendingPayload, acknowledge: true };
      const result = session
        ? await updateSession(session.id, acknowledgedPayload)
        : await createSession(acknowledgedPayload);
      onSuccess(result);
      resetForm();
    } catch (err) {
      if (err.response?.status === 409) {
        setConflictData(err.response.data);
        setPendingPayload({ ...pendingPayload, acknowledge: true });
      } else {
        setError(extractApiError(err, 'Failed to save session. Please try again.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setConflictData(null);
    onClose();
  };

  // Derived labels — avoid nested ternaries in JSX.
  let modalTitle = 'Schedule New Session';
  if (isPastSession) { modalTitle = 'Correct Session Details'; } else if (session) { modalTitle = 'Edit Session'; }

  let savingLabel = 'Creating...';
  if (isPastSession) { savingLabel = 'Saving...'; } else if (session) { savingLabel = 'Updating...'; }

  let saveLabel = 'Create Session';
  if (isPastSession) { saveLabel = 'Save corrections'; } else if (session) { saveLabel = 'Update Session'; }

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      footerNode={(
        <>
          <Button variant="tertiary" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading} className="ml-2">
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="mr-2" />
                {savingLabel}
              </>
            ) : saveLabel}
          </Button>
        </>
      )}
    >
      <div style={{
        maxHeight: 'calc(80vh - 10rem)', overflowY: 'auto', overflowX: 'hidden', padding: '0 4px',
      }}
      >
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')} ref={errorRef}>
            {error}
          </Alert>
        )}

        {/* Hard-block conflict — admin must resolve before saving */}
        {conflictData && !conflictData.override_allowed && (
          <Alert variant="danger" className="mb-3" ref={conflictRef}>
            <strong>{conflictData.message}</strong>
            <ul className="mt-2 mb-0 pl-4">
              {conflictData.affected_entities.map((entity, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <li key={i}>
                  {entity.type === 'instructor' && (
                    <>
                      <strong>{entity.email}</strong>
                      {' → '}
                      &ldquo;{entity.conflicting_session_name}&rdquo;
                      {entity.program_name && ` (${entity.program_name})`}
                      {entity.scheduled_start_time && (
                        <>
                          {' · '}
                          {new Date(entity.scheduled_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(entity.scheduled_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </>
                      )}
                    </>
                  )}
                  {entity.type === 'room' && (
                    <>
                      &ldquo;{entity.name}&rdquo; is booked
                      {entity.session_title && ` for “${entity.session_title}”`}
                      {entity.program_name && ` (${entity.program_name})`}
                      {entity.scheduled_start_time && (
                        <>
                          {' · '}
                          {new Date(entity.scheduled_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {' – '}
                          {new Date(entity.scheduled_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </>
                      )}
                    </>
                  )}
                  {entity.type === 'session' && (
                    <>
                      <strong>{entity.title}</strong>
                      {': '}
                      {new Date(entity.scheduled_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' – '}
                      {new Date(entity.scheduled_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {conflictData.conflict_type === 'ROOM_DOUBLE_BOOKING' && conflictData.resolution_hints.length > 0 && (
              <div className="mt-2" style={{ fontSize: 13 }}>
                Available rooms:{' '}
                {conflictData.resolution_hints
                  .map((id) => locationOptions.find((o) => o.value === id)?.label)
                  .filter(Boolean)
                  .join(', ') || 'check Locations for availability'}
              </div>
            )}
          </Alert>
        )}

        {/* Soft warn (PROTECTED_DATE) — admin can override */}
        {conflictData?.override_allowed && (
          <Alert variant="warning" className="mb-3" ref={conflictRef}>
            <strong>{conflictData.message}</strong>
            <div className="mt-2">
              <Button size="sm" variant="primary" onClick={handleProceedAnyway} disabled={loading}>
                Proceed anyway
              </Button>
              <Button size="sm" variant="tertiary" onClick={() => setConflictData(null)} className="ml-2">
                Cancel
              </Button>
            </div>
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          {isPastSession && (
            <Alert variant="info" className="mb-3">
              This session has already taken place. Only the <strong>course</strong>,
              {' '}<strong>instructors</strong>, and <strong>location</strong> can be corrected.
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Title {!isPastSession && '*'}</Form.Label>
            <Form.Control
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required={!isPastSession}
              placeholder="e.g., Week 5 Live Session"
              disabled={isPastSession}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Session Type *</Form.Label>
            <Form.Control
              as="select"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              disabled={isPastSession}
            >
              {sessionTypeOptions.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Form.Control>
          </Form.Group>

          <SearchableSelect
            id="session-course-run"
            label="Course"
            options={courseRunOptions}
            value={selectedCourseRun}
            onChange={setSelectedCourseRun}
            placeholder="Search by course title..."
            loading={courseRunsLoading}
            required={isSessionType}
          />

          <SearchableSelect
            id="session-instructor"
            label="Instructor"
            options={instructorOptions}
            value={selectedInstructors}
            onChange={setSelectedInstructors}
            multiple
            placeholder={isPastSession || selectedCourseRun || !isSessionType ? 'Search by name...' : 'Select a course first'}
            loading={instructorsLoading}
            disabled={!isPastSession && isSessionType && !selectedCourseRun}
            required={isSessionType}
            isInvalid={!!fieldErrors.instructors}
          />

          <SearchableSelect
            id="session-location"
            label="Location"
            options={locationOptions}
            value={selectedLocation}
            onChange={setSelectedLocation}
            placeholder={locationsLoading ? 'Loading locations…' : 'Search locations…'}
            loading={locationsLoading}
            required={!isPastSession && isSessionType}
            isInvalid={!!fieldErrors.location}
          />

          <Form.Group className="mb-3">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Add session details..."
              disabled={isPastSession}
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Start date and time {!isPastSession && '*'}</Form.Label>
            <div className="row g-2">
              <div className="col-7">
                <Form.Control
                  type="date"
                  value={startDateInput}
                  onChange={handleStartDateChange}
                  aria-label="Start date"
                  required={!isPastSession}
                  disabled={isPastSession}
                  style={(fieldErrors.startDate || fieldErrors.startTime) ? { borderColor: '#dc3545' } : undefined}
                />
              </div>
              <div className="col-5">
                <Form.Control
                  type="time"
                  value={startTimeInput}
                  onChange={handleStartTimeChange}
                  aria-label="Start time"
                  step="60"
                  required={!isPastSession}
                  disabled={isPastSession}
                  style={fieldErrors.startTime ? { borderColor: '#dc3545' } : undefined}
                />
              </div>
            </div>
          </Form.Group>

          {schedulingWarning && (
            <Alert variant="warning" className="mb-3 py-2" style={{ fontSize: 13 }}>
              {schedulingWarning}
            </Alert>
          )}

          <Form.Group className="mb-3">
            <Form.Label>End date and time {!isPastSession && '*'}</Form.Label>
            <div className="row g-2">
              <div className="col-7">
                <Form.Control
                  type="date"
                  value={endDateInput}
                  onChange={handleEndDateChange}
                  aria-label="End date"
                  required={!isPastSession}
                  disabled={isPastSession}
                  style={fieldErrors.endTime ? { borderColor: '#dc3545' } : undefined}
                />
              </div>
              <div className="col-5">
                <Form.Control
                  type="time"
                  value={endTimeInput}
                  onChange={handleEndTimeChange}
                  aria-label="End time"
                  step="60"
                  required={!isPastSession}
                  disabled={isPastSession}
                  style={fieldErrors.endTime ? { borderColor: '#dc3545' } : undefined}
                />
              </div>
            </div>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Checkbox
              id="create-zoom-meeting-toggle"
              name="create_zoom_meeting"
              checked={createZoomMeeting}
              onChange={(e) => {
                const next = e.target.checked;
                setCreateZoomMeeting(next);
              }}
              disabled={isPastSession || Boolean(session?.create_zoom_meeting)}
            >
              Create Zoom meeting for this session
            </Form.Checkbox>
            <Form.Text className="text-muted">
              {session?.meeting_id && !session?.create_zoom_meeting ? (
                <>
                  This session has a Zoom meeting created from a remote-attendance
                  request. Checking this opens it to all enrolled learners and
                  auto-approves any pending remote requests.
                </>
              ) : (
                <>
                  Only create a Zoom meeting if you plan to use it for this session.
                  Remote learners get individual Zoom links when you approve their
                  session requests.
                </>
              )}
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-0">
            <Form.Checkbox
              id="recurring-meeting-toggle"
              name="is_recurring"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              disabled={isPastSession || Boolean(session?.is_recurring)}
            >
              Recurring meeting
            </Form.Checkbox>
          </Form.Group>

          {isRecurring && (
          <fieldset disabled={isPastSession} style={{ border: 'none', padding: 0, margin: 0 }}>
            <div
              className="mt-3 p-3 rounded"
              style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}
            >
              {/* ── Repeat every ── */}
              <div className="d-flex align-items-center mb-3" style={{ gap: '0.6rem' }}>
                <span style={{ color: '#3d3d3d', whiteSpace: 'nowrap' }}>Repeat every</span>
                <Form.Control
                  as="select"
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value)}
                  size="sm"
                  style={{ width: 'auto' }}
                >
                  {RECURRENCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Form.Control>
              </div>
              {/* ── Weekly: circular day buttons ── */}
              {recurrenceType === 'weekly' && (
              <Form.Group className="mb-3">
                <Form.Label>Repeat on</Form.Label>
                <div className="d-flex" style={{ gap: '0.35rem' }}>
                  {ALL_WEEK_DAYS.map((day) => {
                    const selected = weeklyDays.includes(day.value);
                    return (
                      <OverlayTrigger
                        key={day.value}
                        placement="top"
                        overlay={<Tooltip id={`day-tip-${day.value}`}>{day.fullName}</Tooltip>}
                      >
                        <button
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            if (selected) {
                              setWeeklyDays(weeklyDays.filter((d) => d !== day.value));
                            } else {
                              setWeeklyDays([...weeklyDays, day.value]);
                            }
                          }}
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            border: `1px solid ${selected ? '#0d6efd' : '#ced4da'}`,
                            background: selected ? '#0d6efd' : 'transparent',
                            color: selected ? '#fff' : '#3d3d3d',
                            fontWeight: selected ? 600 : 400,
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            padding: 0,
                            flexShrink: 0,
                          }}
                        >
                          {day.letter}
                        </button>
                      </OverlayTrigger>
                    );
                  })}
                </div>
                {weeklyDays.length === 0 && (
                  <small className="text-danger d-block mt-1">Select at least one day.</small>
                )}
              </Form.Group>
              )}

              {/* ── Monthly: smart single dropdown ── */}
              {recurrenceType === 'monthly' && (
              <Form.Group className="mb-3">
                <Form.Control
                  as="select"
                  value={monthlyMode}
                  onChange={(e) => setMonthlyMode(e.target.value)}
                  size="sm"
                  style={{ width: 'auto' }}
                >
                  {monthlyDay <= 28 && (
                    <option value="day">Monthly on day {monthlyDay}</option>
                  )}
                  <option value="week">{`Monthly on the ${MONTHLY_WEEKS.find((w) => w.value === monthlyWeek)?.label?.toLowerCase() ?? 'first'} ${ALL_WEEK_DAYS.find((d) => d.value === monthlyWeekDay)?.fullName ?? 'Monday'}`}</option>
                </Form.Control>
                {monthlyDay >= 29 && (
                  <small className="text-muted d-block mt-1">
                    Day {monthlyDay} doesn’t exist in all months, so only the weekday option is available.
                  </small>
                )}
              </Form.Group>
              )}

              {/* ── Ends — vertically stacked (GCal style) ── */}
              <Form.Group className="mb-3">
                <Form.Label>Ends</Form.Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
                    <input type="radio" id="end-date" name="endType" checked={endType === 'date'} onChange={() => setEndType('date')} />
                    <label htmlFor="end-date" className="mb-0" style={{ minWidth: '42px' }}>On</label>
                    <div className="d-flex align-items-center" style={{ gap: '0.4rem' }}>
                      <Form.Control
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndType('date'); setEndDate(e.target.value); }}
                        onClick={() => setEndType('date')}
                        size="sm"
                        style={{ width: '150px', flexShrink: 0, flexGrow: 0 }}
                        max={getMaxEndDate(formData.scheduled_start_time)}
                      />
                      <small style={{ color: '#6c757d', whiteSpace: 'nowrap' }}>(max {MAX_END_MONTHS} months)</small>
                    </div>
                  </div>
                  <div className="d-flex align-items-center" style={{ gap: '0.75rem' }}>
                    <input type="radio" id="end-count" name="endType" checked={endType === 'count'} onChange={() => setEndType('count')} />
                    <label htmlFor="end-count" className="mb-0" style={{ minWidth: '42px' }}>After</label>
                    <div className="d-flex align-items-center" style={{ gap: '0.4rem' }}>
                      <Form.Control
                        type="text"
                        inputMode="numeric"
                        value={endCount}
                        onChange={(e) => {
                          setEndType('count');
                          const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
                          if (!Number.isNaN(v)) {
                            setEndCount(Math.min(MAX_END_COUNT, Math.max(1, v)));
                          }
                        }}
                        onClick={() => setEndType('count')}
                        size="sm"
                        style={{ width: '56px', textAlign: 'center', flexShrink: 0 }}
                      />
                      <span style={{ color: '#3d3d3d', whiteSpace: 'nowrap' }}>occurrences</span>
                      <small style={{ color: '#6c757d', whiteSpace: 'nowrap' }}>(max {MAX_END_COUNT})</small>
                    </div>
                  </div>
                </div>
              </Form.Group>

              {/* ── Live summary ── */}
              {buildSummary({
                recurrenceType,
                weeklyDays,
                monthlyMode,
                monthlyDay,
                monthlyWeek,
                monthlyWeekDay,
                endType,
                endCount,
                endDate,
              }) && (
              <div
                className="d-flex align-items-center rounded p-2"
                style={{
                  backgroundColor: '#e8f4fd', border: '1px solid #b8daff', gap: '0.5rem', marginTop: '0.25rem',
                }}
              >
                <span style={{ fontSize: '1rem' }}>📅</span>
                <small style={{ color: '#0c5460' }}>
                  {buildSummary({
                    recurrenceType,
                    weeklyDays,
                    monthlyMode,
                    monthlyDay,
                    monthlyWeek,
                    monthlyWeekDay,
                    endType,
                    endCount,
                    endDate,
                  })}
                </small>
              </div>
              )}
            </div>
          </fieldset>
          )}

        </Form>
      </div>
    </StandardModal>
  );
};

// Loose propTypes — `session` is an upstream API payload with many fields;
// declaring it as `PropTypes.object` lets react/prop-types skip deep-access
// validation that would otherwise flag every `session.X` read in this file.
ScheduleMeetingModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  programKey: PropTypes.string,
  onSuccess: PropTypes.func.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  session: PropTypes.object,
  holidays: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
    date: PropTypes.string,
    name: PropTypes.string,
  })),
};
ScheduleMeetingModal.defaultProps = {
  programKey: '',
  session: null,
  holidays: [],
};

export default ScheduleMeetingModal;
