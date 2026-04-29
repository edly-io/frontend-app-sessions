import React from 'react';
import PropTypes from 'prop-types';
import { NavLink, useParams } from 'react-router-dom';

const ADMIN_ITEMS = [
  { slug: 'sessions', label: 'Sessions' },
  { slug: 'summary', label: 'Course Summary' },
  { slug: 'by-learner', label: 'Per-Learner' },
];

const LEARNER_ITEMS = [
  { slug: 'me', label: 'My Attendance' },
];

const AttendanceSubNav = ({ isAdmin }) => {
  const { programId } = useParams();
  const items = isAdmin ? ADMIN_ITEMS : LEARNER_ITEMS;

  // Hide the rail entirely when there's only one destination.
  if (items.length <= 1) { return null; }

  return (
    <nav
      aria-label="Attendance sub-sections"
      className="d-flex flex-wrap mb-3"
      style={{ gap: 4 }}
    >
      {items.map(({ slug, label }) => (
        <NavLink
          key={slug}
          to={`/sessions/${programId}/attendance/${slug}`}
          className={({ isActive }) => [
            'px-3 py-1',
            'rounded-pill',
            'text-decoration-none',
            isActive ? 'bg-primary text-white' : 'text-muted',
          ].join(' ')}
          style={{ fontSize: 14 }}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
};

AttendanceSubNav.propTypes = {
  isAdmin: PropTypes.bool.isRequired,
};

export default AttendanceSubNav;
