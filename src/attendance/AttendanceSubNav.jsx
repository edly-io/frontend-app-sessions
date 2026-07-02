import React from 'react';
import { NavLink, useLocation, useParams } from 'react-router-dom';

const ADMIN_ITEMS = [
  { slug: 'by-course', label: 'By Course' },
  { slug: 'by-learner', label: 'By Learner' },
  { slug: 'summary', label: 'Summary' },
];

const AttendanceSubNav = () => {
  const { programId } = useParams();
  const { pathname } = useLocation();
  const isSessionRoute = pathname.includes('/attendance/sessions/');

  return (
    <nav
      aria-label="Attendance sub-sections"
      className="d-flex flex-wrap mb-3"
      style={{ gap: 4 }}
    >
      {ADMIN_ITEMS.map(({ slug, label }) => (
        <NavLink
          key={slug}
          to={`/${programId}/attendance/${slug}`}
          className={({ isActive }) => {
            const active = isActive || (slug === 'by-course' && isSessionRoute);
            return [
              'px-3 py-1',
              'rounded-pill',
              'text-decoration-none',
              active ? 'bg-primary text-white' : 'text-muted',
            ].join(' ');
          }}
          style={{ fontSize: 14 }}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
};

export default AttendanceSubNav;
