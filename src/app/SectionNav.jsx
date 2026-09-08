import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Tab, Tabs } from '@openedx/paragon';
import { USER_ROLE } from '../shared/constants';
import { useConfig } from './useConfig';

const SECTIONS = [
  { slug: 'courses', label: 'Courses' },
  { slug: 'calendar', label: 'Calendar' },
  { slug: 'requests', label: 'Requests' },
  { slug: 'attendance', label: 'Attendance', hideForInstructor: true },
  { slug: 'certificate', label: 'Certificate', learnerOnly: true },
  { slug: 'locations', label: 'Locations', adminOnly: true },
  { slug: 'holidays', label: 'Holidays', adminOnly: true },
];

const SectionNav = () => {
  const { programId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;
  const isInstructor = config?.user_role === USER_ROLE.INSTRUCTOR;
  const isLearner = config?.user_role === USER_ROLE.LEARNER;
  const visibleSections = SECTIONS.filter((s) => {
    if (s.adminOnly && !isAdmin) { return false; }
    if (s.hideForInstructor && isInstructor) { return false; }
    if (s.learnerOnly && !isLearner) { return false; }
    return true;
  });

  // Read positionally: `programId` carries `:` and `+`, which would need
  // escaping to compare against. Sub-routes still resolve to their section.
  const currentSlug = pathname.split('/').filter(Boolean)[1];
  const activeKey = visibleSections.some(({ slug }) => slug === currentSlug)
    ? currentSlug
    : undefined;

  const handleSelect = (slug) => {
    if (slug && slug !== activeKey) {
      navigate(`/${programId}/${slug}`);
    }
  };

  // `inverse-tabs` is Paragon's dark-surface variant. Tabs are childless
  // because the sections are routes — the router renders the content.
  //
  // Paragon measures the strip on mount and re-measures only when the strip
  // resizes, not when tabs are added. `useConfig` is async, so the first
  // measurement sees just the four role-agnostic sections and the rest stay
  // stranded in "More...". Keying on the section list remounts the strip when
  // the roles land, so Paragon measures the real set.
  return (
    <Tabs
      key={visibleSections.map(({ slug }) => slug).join()}
      id="sessions-section-nav"
      variant="inverse-tabs"
      activeKey={activeKey}
      onSelect={handleSelect}
      moreTabText="More..."
      className="section-nav"
    >
      {visibleSections.map(({ slug, label }) => (
        <Tab key={slug} eventKey={slug} title={label} />
      ))}
    </Tabs>
  );
};

export default SectionNav;
