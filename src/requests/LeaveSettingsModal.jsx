import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Spinner, StandardModal, useToggle,
} from '@openedx/paragon';
import { Settings } from '@openedx/paragon/icons';
import { getProgram, updateProgram } from '../app/api';
import ThresholdControl from './ThresholdControl';

// "Leave settings" header button + modal. Loads the program's threshold when
// opened so nothing is fetched until an admin actually wants to edit it.
const LeaveSettingsModal = ({ programKey }) => {
  const [isOpen, open, close] = useToggle(false);
  const [initial, setInitial] = useState(null);
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleOpen = () => {
    open();
    setError('');
    setLoading(true);
    getProgram(programKey)
      .then((p) => {
        const t = p.threshold ?? 0;
        setInitial(t);
        setValue(t);
      })
      .catch(() => setError("Couldn't load leave settings. Try again."))
      .finally(() => setLoading(false));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await updateProgram(programKey, { threshold: value });
      close();
      // Flags, at-risk counts and usage all derive from the threshold server-side.
      window.location.reload();
    } catch {
      setError('Failed to save threshold.');
    } finally {
      setSaving(false);
    }
  };

  const canSave = !loading && !saving && initial !== null
    && value !== '' && value >= 0 && value !== initial;

  return (
    <>
      <Button variant="outline-primary" size="sm" iconBefore={Settings} onClick={handleOpen}>
        Leave settings
      </Button>
      <StandardModal
        isOpen={isOpen}
        onClose={close}
        title="Leave settings"
        size="md"
        isFullscreenOnMobile
        footerNode={(
          <>
            <Button variant="tertiary" onClick={close} disabled={saving}>Cancel</Button>
            <Button variant="primary" className="ml-2" onClick={handleSave} disabled={!canSave}>
              {saving && <Spinner animation="border" size="sm" className="mr-1" screenReaderText="Saving" />}
              Save
            </Button>
          </>
        )}
      >
        {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
        {loading ? (
          <div className="text-center py-3">
            <Spinner animation="border" screenReaderText="Loading leave settings" />
          </div>
        ) : (
          initial !== null && (
            <ThresholdControl value={value} onChange={setValue} disabled={saving} />
          )
        )}
      </StandardModal>
    </>
  );
};

LeaveSettingsModal.propTypes = {
  programKey: PropTypes.string.isRequired,
};

export default LeaveSettingsModal;
