import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Badge, Button, Col, Form, Row, Spinner,
} from '@openedx/paragon';
import { updateProgram } from '../app/api';
import './requests.scss';

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
    <Row className="requests-filters align-items-end">
      <Col xs="auto" className="mb-2">
        <Form.Label htmlFor="leave-threshold" className="requests-filters__label">
          Leave threshold
        </Form.Label>
        <Form.Control
          id="leave-threshold"
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="requests-filters__number"
          disabled={saving}
        />
      </Col>
      <Col xs="auto" className="mb-2">
        <Button
          variant="outline-primary"
          size="sm"
          onClick={handleSave}
          disabled={saving || value === initialThreshold}
        >
          {saving ? <Spinner animation="border" size="sm" /> : 'Save'}
        </Button>
      </Col>
      {(saved || error) && (
        <Col xs="auto" className="mb-2">
          {saved && <Badge variant="success">Saved</Badge>}
          {error && <Badge variant="danger">{error}</Badge>}
        </Col>
      )}
    </Row>
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
