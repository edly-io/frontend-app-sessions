import React from 'react';
import PropTypes from 'prop-types';
import {
  Badge, OverlayTrigger, Tooltip, Icon,
} from '@openedx/paragon';
import { InfoOutline } from '@openedx/paragon/icons';

const SCOPES = {
  public: {
    label: 'Open to all learners',
    variant: 'success',
    tooltip: 'Zoom link is visible to every enrolled learner in this course.',
  },
  gated: {
    label: 'Approved learners only',
    variant: 'warning',
    tooltip: 'Zoom link created after approving a remote-attendance request. Only learners whose requests you approved can see it.',
  },
  in_person: {
    label: 'In-person',
    variant: 'secondary',
    tooltip: 'No Zoom link. This session happens in-person only.',
  },
};

const ScopeBadge = ({ scope }) => {
  const def = SCOPES[scope];
  if (!def) { return null; }
  return (
    <span className="d-inline-flex align-items-center" style={{ gap: 4 }}>
      <Badge variant={def.variant}>{def.label}</Badge>
      <OverlayTrigger
        trigger={['hover', 'focus']}
        placement="top"
        overlay={<Tooltip id={`scope-tip-${scope}`}>{def.tooltip}</Tooltip>}
      >
        <button
          type="button"
          aria-label={def.tooltip}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'help',
          }}
        >
          <Icon src={InfoOutline} style={{ width: 14, height: 14, color: '#6c757d' }} />
        </button>
      </OverlayTrigger>
    </span>
  );
};

ScopeBadge.propTypes = {
  scope: PropTypes.oneOf(['public', 'gated', 'in_person']).isRequired,
};

export default ScopeBadge;
