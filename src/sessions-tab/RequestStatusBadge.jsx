import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@openedx/paragon';

import {
  REQUEST_STATUS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_VARIANTS,
  REQUEST_TYPE,
  REQUEST_TYPE_LABELS,
} from './constants';

/**
 * Compact status readout of the learner's request for a given session.
 *
 * Rendered in session popovers in place of the default "Join" / "Request"
 * button once a request exists. Returns `null` when there is no request —
 * the caller decides what to render in that case (typically a "Request" CTA).
 *
 * Visible states:
 *   - pending → warning badge
 *   - approved + remote_zoom → success badge + Join link to the personal meeting
 *   - approved + leave → success "Leave approved" badge
 *   - rejected → danger badge
 */
const RequestStatusBadge = ({ request }) => {
  if (!request) { return null; }

  const { status, request_type: requestType } = request;
  const variant = REQUEST_STATUS_VARIANTS[status] || 'secondary';
  const label = REQUEST_STATUS_LABELS[status] || status;

  // Approved remote_zoom: personal meeting was provisioned — show a join badge.
  if (
    status === REQUEST_STATUS.APPROVED
    && requestType === REQUEST_TYPE.REMOTE_ZOOM
  ) {
    return <Badge variant={variant}>Remote approved</Badge>;
  }

  if (status === REQUEST_STATUS.APPROVED && requestType === REQUEST_TYPE.LEAVE) {
    return <Badge variant={variant}>Leave approved</Badge>;
  }

  return (
    <Badge variant={variant} title={REQUEST_TYPE_LABELS[requestType]}>
      {`${label} · ${REQUEST_TYPE_LABELS[requestType] || requestType}`}
    </Badge>
  );
};

RequestStatusBadge.propTypes = {
  request: PropTypes.shape({
    status: PropTypes.string.isRequired,
    request_type: PropTypes.string.isRequired,
    meeting_join_url: PropTypes.string,
  }),
};

RequestStatusBadge.defaultProps = {
  request: null,
};

export default RequestStatusBadge;
