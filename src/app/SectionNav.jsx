import React from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { USER_ROLE } from '../shared/constants';
import { useConfig } from './useConfig';

const SECTIONS = [
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
    <nav
      aria-label="Sessions admin sections"
      className="d-flex"
      style={{ gap: 4, borderBottom: '1px solid #dee2e6' }}
    >
      {visibleSections.map(({ slug, label }) => (
        <NavLink
          key={slug}
          to={`/${programId}/${slug}`}
          className={({ isActive }) => [
            'px-3 py-2',
            'text-decoration-none',
            isActive ? 'text-primary font-weight-bold' : 'text-muted',
          ].join(' ')}
          style={({ isActive }) => ({
            borderBottom: isActive ? '2px solid #0d6efd' : '2px solid transparent',
            marginBottom: -1,
          })}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
};

export default SectionNav;
