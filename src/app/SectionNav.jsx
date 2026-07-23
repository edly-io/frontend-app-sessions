import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { USER_ROLE } from '../shared/constants';
import { useConfig } from './useConfig';

const SECTIONS = [
  { slug: 'courses', label: 'Courses' },
  { slug: 'calendar', label: 'Calendar' },
  { slug: 'requests', label: 'Requests' },
  { slug: 'attendance', label: 'Attendance', hideForInstructor: true },
  { slug: 'locations', label: 'Locations', adminOnly: true },
  { slug: 'holidays', label: 'Holidays', adminOnly: true },
];

const SectionNav = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;
  const isInstructor = config?.user_role === USER_ROLE.INSTRUCTOR;
  const visibleSections = SECTIONS.filter((s) => {
    if (s.adminOnly && !isAdmin) { return false; }
    if (s.hideForInstructor && isInstructor) { return false; }
    return true;
  });

  return (
    <nav aria-label="Sessions admin sections" className="section-nav">
      {visibleSections.map(({ slug, label }) => (
        <NavLink
          key={slug}
          to={`/${programId}/${slug}`}
          className={({ isActive }) => `section-nav__link${isActive ? ' active' : ''}`}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
};

export default SectionNav;
