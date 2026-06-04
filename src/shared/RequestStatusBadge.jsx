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

  // my_request from the calendar API uses `type`; requests from the list API use `type_slug`.
  const { state, type_slug: typeSlug, type: typeField } = request;
  const effectiveType = typeSlug || typeField;
  const variant = REQUEST_STATUS_VARIANTS[state] || 'secondary';
  const label = REQUEST_STATUS_LABELS[state] || state;

  if (state === REQUEST_STATUS.APPROVED && effectiveType === REQUEST_TYPE.REMOTE_SESSION) {
    return <Badge variant={variant}>Remote approved</Badge>;
  }

  if (state === REQUEST_STATUS.APPROVED && effectiveType === REQUEST_TYPE.LEAVE) {
    return <Badge variant={variant}>Leave approved</Badge>;
  }

  return (
    <Badge variant={variant} title={REQUEST_TYPE_LABELS[effectiveType]}>
      {`${label} · ${REQUEST_TYPE_LABELS[effectiveType] || effectiveType}`}
    </Badge>
  );
};

RequestStatusBadge.propTypes = {
  request: PropTypes.shape({
    state: PropTypes.string.isRequired,
    type_slug: PropTypes.string,
    type: PropTypes.string,
  }),
};

RequestStatusBadge.defaultProps = {
  request: null,
};

export default RequestStatusBadge;
