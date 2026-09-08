import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  MemoryRouter, Route, Routes, useLocation,
} from 'react-router-dom';
import SectionNav from './SectionNav';
import { useConfig } from './useConfig';
import { USER_ROLE } from '../shared/constants';

jest.mock('./useConfig', () => ({ useConfig: jest.fn() }));

const PROGRAM_ID = 'program-v1:FBR+DST+2025-B';

// jsdom has no layout engine, so every rect is 0 wide and Paragon would
// overflow every tab. These supply widths for it to measure.
const TAB_WIDTH = 100;
const MORE_WIDTH = 90;

const widthOf = (element, stripWidth) => {
  if (element.classList?.contains('section-nav')) { return stripWidth; }
  if (element.classList?.contains('pgn__tab_more')) { return MORE_WIDTH; }
  if (element.classList?.contains('nav-link')) { return TAB_WIDTH; }
  return 0;
};

const mockLayout = (stripWidth) => {
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    const width = widthOf(this, stripWidth);
    return {
      width, height: 40, top: 0, left: 0, right: width, bottom: 40, x: 0, y: 0,
    };
  });
};

const LocationProbe = () => <span data-testid="pathname">{useLocation().pathname}</span>;

const renderNav = ({
  role = USER_ROLE.ADMIN, stripWidth = 2000, section = 'courses',
} = {}) => {
  useConfig.mockReturnValue({ data: { user_role: role } });
  mockLayout(stripWidth);
  return render(
    <MemoryRouter initialEntries={[`/${PROGRAM_ID}/${section}`]}>
      <Routes>
        <Route
          path="/:programId/*"
          element={<><SectionNav /><LocationProbe /></>}
        />
      </Routes>
    </MemoryRouter>,
  );
};

// Paragon keeps overflowed tabs in the DOM, flagged `pgn__tab_invisible`.
const stripLabels = () => screen.getAllByRole('tab')
  .filter((el) => !el.classList.contains('pgn__tab_invisible')
    && !el.classList.contains('pgn__tab_more'))
  .map((el) => el.textContent);

const moreTab = () => document.querySelector('.pgn__tab_more');
const moreToggle = () => screen.getByRole('button', { name: 'More...' });
const activeTab = () => screen.getAllByRole('tab').find((el) => el.classList.contains('active'));

// react-bootstrap mounts the menu only once opened.
const openMore = () => {
  fireEvent.click(moreToggle());
  return [...moreTab().querySelectorAll('.dropdown-menu .dropdown-item')];
};

const pathname = () => screen.getByTestId('pathname').textContent;

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('SectionNav', () => {
  it('renders every section available to the role as a tab', () => {
    renderNav();

    expect(stripLabels()).toEqual([
      'Courses', 'Calendar', 'Requests', 'Attendance', 'Locations', 'Holidays',
    ]);
  });

  it('marks the current section active', () => {
    renderNav({ section: 'calendar' });

    expect(activeTab()).toHaveTextContent('Calendar');
  });

  it('treats a sub-route as its parent section', () => {
    renderNav({ section: 'requests/leaves' });

    expect(activeTab()).toHaveTextContent('Requests');
  });

  it('routes to the picked section', () => {
    renderNav({ section: 'courses' });

    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }));

    expect(pathname()).toBe(`/${PROGRAM_ID}/calendar`);
  });

  it('hides the "More..." tab when every section fits', () => {
    renderNav({ stripWidth: 2000 });

    expect(moreTab()).toHaveClass('pgn__tab_invisible');
  });

  it('moves the sections that do not fit into the "More..." dropdown', () => {
    // "More..." (90px) plus three 100px tabs fits 400px; the rest does not.
    renderNav({ stripWidth: 400 });

    expect(stripLabels()).toEqual(['Courses', 'Calendar', 'Requests']);
    expect(moreTab()).not.toHaveClass('pgn__tab_invisible');
    expect(openMore().map((el) => el.textContent))
      .toEqual(['Attendance', 'Locations', 'Holidays']);
  });

  it('routes from the "More..." dropdown too', () => {
    renderNav({ stripWidth: 400, section: 'courses' });

    const items = openMore();
    fireEvent.click(items[1]);

    expect(pathname()).toBe(`/${PROGRAM_ID}/locations`);
  });

  // The visible marker comes from the `:has` rule in programs.scss; this
  // asserts the DOM state that rule keys on.
  it('leaves the current section flagged active even once it has overflowed', () => {
    renderNav({ stripWidth: 400, section: 'holidays' });

    expect(stripLabels()).not.toContain('Holidays');
    expect(activeTab()).toHaveTextContent('Holidays');
    expect(activeTab()).toHaveClass('pgn__tab_invisible');
  });

  it('leaves the "More..." tab unflagged when the current section is in the strip', () => {
    renderNav({ stripWidth: 400, section: 'courses' });

    expect(stripLabels()).toContain('Courses');
    expect(moreTab()).not.toHaveClass('active');
  });

  // Paragon measures the strip once on mount and re-measures only when the
  // strip itself resizes, not when tabs are added. `useConfig` is async, so
  // the first measurement sees only the 4 role-agnostic sections.
  it('re-measures when role-gated sections arrive after the first render', () => {
    useConfig.mockReturnValue({ data: undefined });
    mockLayout(2000);
    const { rerender } = render(
      <MemoryRouter initialEntries={[`/${PROGRAM_ID}/courses`]}>
        <Routes>
          <Route path="/:programId/*" element={<><SectionNav /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(stripLabels()).toEqual(['Courses', 'Calendar', 'Requests', 'Attendance']);

    useConfig.mockReturnValue({ data: { user_role: USER_ROLE.ADMIN } });
    rerender(
      <MemoryRouter initialEntries={[`/${PROGRAM_ID}/courses`]}>
        <Routes>
          <Route path="/:programId/*" element={<><SectionNav /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>,
    );

    // 2000px fits all six comfortably, so nothing belongs in the dropdown.
    expect(stripLabels()).toEqual([
      'Courses', 'Calendar', 'Requests', 'Attendance', 'Locations', 'Holidays',
    ]);
    expect(moreTab()).toHaveClass('pgn__tab_invisible');
  });

  it('applies role-based visibility before measuring for overflow', () => {
    renderNav({ role: USER_ROLE.INSTRUCTOR });

    expect(stripLabels()).toEqual(['Courses', 'Calendar', 'Requests']);
  });

  it('offers the learner-only Certificate section to learners', () => {
    renderNav({ role: USER_ROLE.LEARNER });

    expect(stripLabels()).toEqual(['Courses', 'Calendar', 'Requests', 'Attendance', 'Certificate']);
  });
});
