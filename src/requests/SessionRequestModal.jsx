import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  StandardModal,
  Button,
  Form,
  Spinner,
  Alert,
} from '@openedx/paragon';

import { createSessionRequest } from './api';
import { REQUEST_TYPE, REQUEST_TYPE_LABELS } from '../shared/constants';
import { extractApiError, formatDateTime } from '../shared/utils';

/**
 * Learner-facing modal for submitting a SessionRequest.
 *
 * One request per learner per session — submitting here is a terminal action
 * until the reviewer responds. The caller is responsible for refreshing the
 * surrounding UI on success (to pick up the new request state).
 */
const SessionRequestModal = ({
  isOpen, onClose, session, onSuccess, sessionHasZoom,
}) => {
  const [requestType, setRequestType] = useState(REQUEST_TYPE.REMOTE_ZOOM);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset state whenever the modal opens against a new session. When the session
  // already has a public Zoom, remote_zoom is disabled — default to leave so the
  // user doesn't land on a disabled radio.
  useEffect(() => {
    if (!isOpen) { return; }
    setRequestType(sessionHasZoom ? REQUEST_TYPE.LEAVE : REQUEST_TYPE.REMOTE_ZOOM);
    setReason('');
    setError('');
    setLoading(false);
  }, [isOpen, session?.id, sessionHasZoom]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setError('Please provide a reason.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const created = await createSessionRequest({
        session: session.id,
        requestType,
        reason: trimmedReason,
      });
      onSuccess?.(created);
      onClose();
    } catch (err) {
      setError(extractApiError(err, 'Failed to submit request. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  if (!session) { return null; }

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title="Request for this session"
      footerNode={(
        <>
          <Button variant="tertiary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading} className="ml-2">
            {loading ? (
              <>
                <Spinner animation="border" size="sm" className="mr-2" />
                Submitting...
              </>
            ) : 'Submit request'}
          </Button>
        </>
      )}
    >
      <div className="mb-3">
        <div className="font-weight-bold">{session.title}</div>
        <small className="text-muted">
          {formatDateTime(session.scheduled_start_time)}
        </small>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Form onSubmit={handleSubmit}>
        <Form.Group>
          <Form.Label>What are you requesting?</Form.Label>
          <Form.RadioSet
            name="request_type"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
          >
            <Form.Radio value={REQUEST_TYPE.REMOTE_ZOOM} disabled={sessionHasZoom}>
              {REQUEST_TYPE_LABELS[REQUEST_TYPE.REMOTE_ZOOM]}
            </Form.Radio>
            {sessionHasZoom && (
              <Form.Text className="text-muted mb-1">
                A Zoom meeting is already scheduled for this session.
              </Form.Text>
            )}
            <Form.Radio value={REQUEST_TYPE.LEAVE}>
              {REQUEST_TYPE_LABELS[REQUEST_TYPE.LEAVE]}
            </Form.Radio>
          </Form.RadioSet>
        </Form.Group>

        <Form.Group>
          <Form.Label>Reason *</Form.Label>
          <Form.Control
            as="textarea"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly explain why you're requesting this."
            maxLength={1000}
            required
          />
        </Form.Group>
      </Form>
    </StandardModal>
  );
};

SessionRequestModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  sessionHasZoom: PropTypes.bool,
  session: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string,
    scheduled_start_time: PropTypes.string,
  }),
};

SessionRequestModal.defaultProps = {
  onSuccess: undefined,
  sessionHasZoom: false,
  session: null,
};

export default SessionRequestModal;
