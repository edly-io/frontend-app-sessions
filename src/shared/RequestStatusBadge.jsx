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
 * Rendered in session popovers once a request exists. Returns `null` when
 * there is no request.
 */
const RequestStatusBadge = ({ request }) => {
  if (!request) { return null; }

  const { state, type_slug: typeSlug } = request;
  const variant = REQUEST_STATUS_VARIANTS[state] || 'secondary';
  const label = REQUEST_STATUS_LABELS[state] || state;

  if (state === REQUEST_STATUS.APPROVED && typeSlug === REQUEST_TYPE.REMOTE_SESSION) {
    return <Badge variant={variant}>Remote approved</Badge>;
  }

  if (state === REQUEST_STATUS.APPROVED && typeSlug === REQUEST_TYPE.LEAVE_REQUEST) {
    return <Badge variant={variant}>Leave approved</Badge>;
  }

  return (
    <Badge variant={variant} title={REQUEST_TYPE_LABELS[typeSlug]}>
      {`${label} · ${REQUEST_TYPE_LABELS[typeSlug] || typeSlug}`}
    </Badge>
  );
};

RequestStatusBadge.propTypes = {
  request: PropTypes.shape({
    state: PropTypes.string.isRequired,
    type_slug: PropTypes.string.isRequired,
  }),
};

RequestStatusBadge.defaultProps = {
  request: null,
};

export default RequestStatusBadge;
