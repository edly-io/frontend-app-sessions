import React from 'react';
import { render, screen } from '@testing-library/react';

import CalendarPdfDocument from './CalendarPdfDocument';
import { buildCalendarPdfModel } from './calendarPdfData';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

// react-pdf's primitives render to a PDF canvas, not the DOM. Mapping them onto
// host elements lets the document's structure be asserted with plain queries:
// the props that drive pagination (`fixed`, `wrap`, `minPresenceAhead`) are kept
// as data attributes so they can be checked too.
jest.mock('@react-pdf/renderer', () => {
  // eslint-disable-next-line global-require
  const React2 = require('react');
  const host = (name) => function HostElement({
    children, fixed, wrap, minPresenceAhead, size, orientation, render: renderProp, ...rest
  }) {
    return React2.createElement(
      'div',
      {
        'data-pdf': name,
        'data-fixed': fixed ? 'true' : undefined,
        'data-wrap': wrap === false ? 'false' : undefined,
        'data-min-presence-ahead': minPresenceAhead,
        'data-size': size,
        'data-orientation': orientation,
        ...rest,
      },
      renderProp ? renderProp({ pageNumber: 1, totalPages: 2 }) : children,
    );
  };
  return {
    __esModule: true,
    Document: host('Document'),
    Page: host('Page'),
    View: host('View'),
    Text: host('Text'),
    StyleSheet: { create: (styles) => styles },
  };
}, { virtual: true });

const session = (overrides = {}) => ({
  id: 1,
  title: 'Income Tax Audit',
  course_name: 'Customs & Excise Enforcement',
  instructor_names: ['Sara Khan'],
  location: { id: 'l1', name: 'Lahore Hall A' },
  session_type: 'lecture',
  status: 'scheduled',
  scheduled_start_time: '2026-03-02T09:00:00Z',
  scheduled_end_time: '2026-03-02T10:30:00Z',
  ...overrides,
});

const renderDoc = (modelOverrides = {}) => {
  const model = buildCalendarPdfModel({
    sessions: [session()],
    rangeLabel: 'Mar 1 – Mar 7, 2026',
    viewLabel: 'Week',
    programName: '2026-B Programme',
    sessionTypeLabels: { lecture: 'Lecture' },
    ...modelOverrides,
  });
  return { ...render(<CalendarPdfDocument model={model} />), model };
};

describe('CalendarPdfDocument', () => {
  it('prints the title, programme and visible range', () => {
    renderDoc();
    expect(screen.getByText('Session Timetable')).toBeInTheDocument();
    expect(screen.getByText(/2026-B Programme/)).toBeInTheDocument();
    expect(screen.getAllByText(/Mar 1 – Mar 7, 2026/).length).toBeGreaterThan(0);
  });

  it('is landscape A4 so the seven columns fit', () => {
    const { container } = renderDoc();
    const page = container.querySelector('[data-pdf="Page"]');
    expect(page).toHaveAttribute('data-size', 'A4');
    expect(page).toHaveAttribute('data-orientation', 'landscape');
  });

  it('renders every column heading', () => {
    renderDoc();
    ['Time', 'Session', 'Course', 'Instructor(s)', 'Location', 'Type', 'Status']
      .forEach((heading) => expect(screen.getByText(heading)).toBeInTheDocument());
  });

  it('repeats the table header on continuation pages', () => {
    const { container } = renderDoc();
    const headerRow = container.querySelector('[data-fixed="true"]');
    expect(headerRow).toBeInTheDocument();
    expect(headerRow.textContent).toContain('Time');
  });

  it('shows the session detail in the table body', () => {
    renderDoc();
    expect(screen.getByText('Income Tax Audit')).toBeInTheDocument();
    expect(screen.getByText('Customs & Excise Enforcement')).toBeInTheDocument();
    expect(screen.getByText('Sara Khan')).toBeInTheDocument();
    expect(screen.getByText('Lahore Hall A')).toBeInTheDocument();
    expect(screen.getByText('Lecture')).toBeInTheDocument();
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
  });

  it('groups sessions under a heading per day with a count', () => {
    renderDoc({
      sessions: [
        session({ id: 1, scheduled_start_time: '2026-03-02T09:00:00Z' }),
        session({ id: 2, scheduled_start_time: '2026-03-02T13:00:00Z' }),
        session({ id: 3, scheduled_start_time: '2026-03-03T09:00:00Z' }),
      ],
    });
    expect(screen.getByText('2 sessions')).toBeInTheDocument();
    expect(screen.getByText('1 session')).toBeInTheDocument();
  });

  it('keeps each session row whole and each day heading with its sessions', () => {
    const { container } = renderDoc();
    expect(container.querySelector('[data-wrap="false"]')).toBeInTheDocument();
    expect(container.querySelector('[data-min-presence-ahead]')).toBeInTheDocument();
  });

  it('numbers the pages', () => {
    renderDoc();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('handles a day with many sessions without dropping any', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => session({
      id: i + 1,
      title: `Session ${i + 1}`,
      scheduled_start_time: `2026-03-02T${String(8 + i).padStart(2, '0')}:00:00Z`,
    }));
    renderDoc({ sessions });
    expect(screen.getByText('12 sessions')).toBeInTheDocument();
    expect(screen.getByText('Session 12')).toBeInTheDocument();
  });

  it('renders long values in full rather than clipping them', () => {
    const longTitle = 'Statement of Cash Flows of Companies and the Financial Statement of a Company Under the Companies Act, 2017';
    renderDoc({
      sessions: [session({
        title: longTitle,
        instructor_names: ['Muhammad Abdul Rehman Siddiqui', 'Syed Imran Haq Bukhari'],
        location: { id: 'l2', name: 'Directorate of Training & Research Auditorium, Lahore' },
      })],
    });
    expect(screen.getByText(longTitle)).toBeInTheDocument();
    expect(screen.getByText('Muhammad Abdul Rehman Siddiqui, Syed Imran Haq Bukhari')).toBeInTheDocument();
    expect(screen.getByText('Directorate of Training & Research Auditorium, Lahore')).toBeInTheDocument();
  });

  it('prints an empty state instead of a blank table', () => {
    renderDoc({ sessions: [] });
    expect(screen.getByText(/no sessions are scheduled in this period/i)).toBeInTheDocument();
    expect(screen.queryByText('Time')).not.toBeInTheDocument();
  });

  it('falls back to a dash for a missing value', () => {
    renderDoc({ sessions: [session({ location: null })] });
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
