import {
  buildCalendarPdfModel, buildPdfFilename, formatDayHeading, formatSessionTimeRange, slugifyRange,
} from './calendarPdfData';

const session = (overrides = {}) => ({
  id: 1,
  title: 'Income Tax Audit',
  course_name: 'Customs & Excise Enforcement',
  instructor_names: ['Sara Khan'],
  location: { id: 'loc-1', name: 'Lahore Hall A' },
  session_type: 'lecture',
  status: 'scheduled',
  scheduled_start_time: '2026-03-02T09:00:00Z',
  scheduled_end_time: '2026-03-02T10:30:00Z',
  ...overrides,
});

describe('formatSessionTimeRange', () => {
  it('renders a start and end time', () => {
    expect(formatSessionTimeRange(session())).toMatch(/–/);
  });

  it('renders only the start when there is no end time', () => {
    const label = formatSessionTimeRange(session({ scheduled_end_time: null }));
    expect(label).not.toMatch(/–/);
    expect(label).not.toBe('');
  });

  it('returns an empty string for a session with no start', () => {
    expect(formatSessionTimeRange({ })).toBe('');
  });
});

describe('formatDayHeading', () => {
  it('reads weekday, day, short month, year', () => {
    expect(formatDayHeading(new Date('2026-08-03T12:00:00'))).toBe('Monday, 3 Aug, 2026');
  });

  it('does not pad a single-digit day', () => {
    expect(formatDayHeading(new Date('2026-03-07T12:00:00'))).toBe('Saturday, 7 Mar, 2026');
  });
});

describe('buildPdfFilename', () => {
  it('slugifies the range into a filename', () => {
    expect(buildPdfFilename('Mar 1 – Mar 7, 2026')).toBe('calendar-mar-1-mar-7-2026.pdf');
  });

  it('falls back when the range is empty', () => {
    expect(slugifyRange('')).toBe('export');
    expect(buildPdfFilename('')).toBe('calendar-export.pdf');
  });
});

describe('buildCalendarPdfModel', () => {
  it('groups sessions by day and counts them', () => {
    const model = buildCalendarPdfModel({
      sessions: [
        session({ id: 1, scheduled_start_time: '2026-03-02T09:00:00Z' }),
        session({ id: 2, scheduled_start_time: '2026-03-02T13:00:00Z' }),
        session({ id: 3, scheduled_start_time: '2026-03-03T09:00:00Z' }),
      ],
      rangeLabel: 'March 2026',
    });

    expect(model.days[0].label).toBe('Monday, 2 Mar, 2026');
    expect(model.days).toHaveLength(2);
    expect(model.sessionCount).toBe(3);
    expect(model.days[0].sessionCount).toBe(2);
    expect(model.days[1].sessionCount).toBe(1);
  });

  it('orders days and the sessions inside a day chronologically', () => {
    const model = buildCalendarPdfModel({
      sessions: [
        session({ id: 3, scheduled_start_time: '2026-03-04T09:00:00Z' }),
        session({ id: 2, scheduled_start_time: '2026-03-02T15:00:00Z' }),
        session({ id: 1, scheduled_start_time: '2026-03-02T08:00:00Z' }),
      ],
    });

    expect(model.days.map((d) => d.dateKey)).toEqual([...model.days.map((d) => d.dateKey)].sort());
    expect(model.days[0].rows.map((r) => r.id)).toEqual(['1', '2']);
  });

  it('maps every column the timetable prints', () => {
    const [row] = buildCalendarPdfModel({
      sessions: [session()],
      sessionTypeLabels: { lecture: 'Lecture' },
    }).days[0].rows;

    expect(row).toMatchObject({
      id: '1',
      title: 'Income Tax Audit',
      course: 'Customs & Excise Enforcement',
      instructors: 'Sara Khan',
      location: 'Lahore Hall A',
      type: 'Lecture',
      status: 'Scheduled',
    });
    expect(row.time).toEqual(expect.any(String));
  });

  it('joins multiple instructors and falls back to the legacy singular field', () => {
    const many = buildCalendarPdfModel({
      sessions: [session({ instructor_names: ['Sara Khan', 'Imran Haq'] })],
    }).days[0].rows[0];
    expect(many.instructors).toBe('Sara Khan, Imran Haq');

    const legacy = buildCalendarPdfModel({
      sessions: [session({ instructor_names: undefined, instructor_name: 'Ali Raza' })],
    }).days[0].rows[0];
    expect(legacy.instructors).toBe('Ali Raza');
  });

  it('title-cases an unmapped session type', () => {
    const row = buildCalendarPdfModel({
      sessions: [session({ session_type: 'guest_lecture' })],
    }).days[0].rows[0];
    expect(row.type).toBe('Guest Lecture');
  });

  it('keeps long values intact rather than truncating them', () => {
    const longTitle = 'Statement of Cash Flows of Companies and the Financial Statement of a Company Under the Companies Act, 2017';
    const row = buildCalendarPdfModel({
      sessions: [session({ title: longTitle, instructor_names: ['Muhammad Abdul Rehman Siddiqui'] })],
    }).days[0].rows[0];
    expect(row.title).toBe(longTitle);
    expect(row.instructors).toBe('Muhammad Abdul Rehman Siddiqui');
  });

  it('substitutes a placeholder title but leaves other blanks empty', () => {
    const row = buildCalendarPdfModel({
      sessions: [session({
        title: '', course_name: null, location: null, instructor_names: [],
      })],
    }).days[0].rows[0];
    expect(row.title).toBe('Untitled session');
    expect(row.course).toBe('');
    expect(row.location).toBe('');
    expect(row.instructors).toBe('');
  });

  it('skips sessions with no start time, which cannot be placed on a day', () => {
    const model = buildCalendarPdfModel({
      sessions: [session({ id: 9, scheduled_start_time: null })],
    });
    expect(model.days).toHaveLength(0);
    expect(model.sessionCount).toBe(0);
  });

  it('returns an empty model, not a broken one, when there are no sessions', () => {
    const model = buildCalendarPdfModel({ sessions: [], rangeLabel: 'March 2026' });
    expect(model.days).toEqual([]);
    expect(model.sessionCount).toBe(0);
    expect(model.rangeLabel).toBe('March 2026');
    expect(model.title).toBe('Session Timetable');
  });

  it('carries the heading metadata through', () => {
    const model = buildCalendarPdfModel({
      sessions: [session()],
      rangeLabel: 'Mar 1 – Mar 7, 2026',
      viewLabel: 'Week',
      programName: '2026-B Programme',
      generatedAt: new Date('2026-03-01T10:00:00Z'),
    });
    expect(model.rangeLabel).toBe('Mar 1 – Mar 7, 2026');
    expect(model.viewLabel).toBe('Week');
    expect(model.programName).toBe('2026-B Programme');
    expect(model.generatedAt).toEqual(expect.any(String));
  });
});
