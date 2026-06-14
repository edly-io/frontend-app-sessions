import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Form, Spinner } from '@openedx/paragon';
import { updateProgram } from '../app/api';

const ThresholdControl = ({ programKey, initialThreshold, onUpdate }) => {
  const [value, setValue] = useState(initialThreshold);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setValue(initialThreshold); }, [initialThreshold]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const updated = await updateProgram(programKey, { threshold: value });
      const newThreshold = updated.threshold ?? value;
      setValue(newThreshold);
      onUpdate(newThreshold);
      setSaved(true);
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setError('Failed to save threshold.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="d-flex align-items-center flex-wrap" style={{ gap: 8 }}>
      <span style={{ fontWeight: 500, fontSize: 14 }}>Leave threshold:</span>
      <Form.Control
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        style={{ width: 72 }}
        aria-label="Leave threshold"
        disabled={saving}
      />
      <Button
        variant="outline-primary"
        size="sm"
        onClick={handleSave}
        disabled={saving || value === initialThreshold}
      >
        {saving ? <Spinner animation="border" size="sm" /> : 'Save'}
      </Button>
      {saved && <small style={{ color: '#16a34a' }}>Saved</small>}
      {error && <small style={{ color: '#dc2626' }}>{error}</small>}
    </div>
  );
};

ThresholdControl.propTypes = {
  programKey: PropTypes.string.isRequired,
  initialThreshold: PropTypes.number.isRequired,
  onUpdate: PropTypes.func,
};

ThresholdControl.defaultProps = {
  onUpdate: () => {},
};

export default ThresholdControl;
