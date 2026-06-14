import React from 'react';
import { NavLink, useParams } from 'react-router-dom';

import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';

const BASE_ITEMS = [
  { slug: 'leaves', label: 'Leaves' },
  { slug: 'remote-sessions', label: 'Remote Sessions' },
];

const RequestsSubNav = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;
  const items = isAdmin
    ? [...BASE_ITEMS, { slug: 'substitute-requests', label: 'Substitute Requests' }]
    : BASE_ITEMS;
  return (
    <nav
      aria-label="Requests sub-sections"
      className="d-flex flex-wrap mb-3"
      style={{ gap: 4 }}
    >
      {items.map(({ slug, label }) => (
        <NavLink
          key={slug}
          to={`/${programId}/requests/${slug}`}
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

export default RequestsSubNav;
