import React, { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import { Badge } from '@openedx/paragon';

import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';
import { getRequestCounts } from './api';

const BASE_ITEMS = [
  { slug: 'leaves', label: 'Leaves', countKey: 'leaves' },
  { slug: 'remote-sessions', label: 'Remote Sessions', countKey: 'remote_sessions' },
];

const SUBSTITUTE_ITEM = {
  slug: 'substitute-requests',
  label: 'Substitute Requests',
  countKey: 'substitute_requests',
};

const RequestsSubNav = () => {
  const { programId } = useParams();
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;
  const items = isAdmin ? [...BASE_ITEMS, SUBSTITUTE_ITEM] : BASE_ITEMS;

  // Counts are an admin affordance: they say which tab holds work so an admin
  // arriving from the dashboard does not have to open all three to find it.
  // Learners see only their own requests, where a count adds nothing.
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    if (!isAdmin || !programId) { return undefined; }
    let cancelled = false;
    getRequestCounts(programId)
      .then((data) => { if (!cancelled) { setCounts(data); } })
      // Deliberately silent: a badge is decoration on a working page. Failing
      // it must not surface an error over the tabs the admin came here to use.
      .catch(() => { if (!cancelled) { setCounts(null); } });
    return () => { cancelled = true; };
  }, [isAdmin, programId]);

  return (
    <nav
      aria-label="Requests sub-sections"
      className="d-flex flex-wrap mb-3"
      style={{ gap: 4 }}
    >
      {items.map(({ slug, label, countKey }) => {
        const count = counts?.[countKey] ?? 0;
        return (
          <NavLink
            key={slug}
            to={`/${programId}/requests/${slug}`}
            className={({ isActive }) => [
              'px-3 py-1',
              'rounded-pill',
              'text-decoration-none',
              'd-inline-flex align-items-center',
              isActive ? 'bg-primary text-white' : 'text-muted',
            ].join(' ')}
            style={{ fontSize: 14, gap: 6 }}
          >
            {label}
            {/* Zero is not rendered: an empty queue is not news, and a row of
                "0" badges is noise that trains the eye to skip all of them. */}
            {count > 0 && (
              <Badge variant="warning" aria-label={`${count} awaiting action`}>
                {count}
              </Badge>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default RequestsSubNav;
