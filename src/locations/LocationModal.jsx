// LocationModal — create + edit. `location` prop null → create mode.

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, StandardModal,
} from '@openedx/paragon';

import { createLocation, updateLocation } from './api';
import { extractApiError } from '../shared/utils';

const emptyForm = { name: '', description: '', biometric_machine_serial_number: '' };

const LocationModal = ({
  isOpen, onClose, location, onSuccess,
}) => {
  const isEdit = Boolean(location);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) { return; }
    setError('');
    setForm(location ? {
      name: location.name || '',
      description: location.description || '',
      biometric_machine_serial_number: location.biometric_machine_serial_number || '',
    } : emptyForm);
  }, [isOpen, location]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        biometric_machine_serial_number: form.biometric_machine_serial_number.trim(),
      };
      const result = isEdit
        ? await updateLocation(location.id, payload)
        : await createLocation(payload);
      onSuccess(result);
    } catch (err) {
      setError(extractApiError(err, 'Failed to save location'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit location' : 'New location'}
      footerNode={(
        <>
          <Button variant="tertiary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving} className="ml-2">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      )}
    >
      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      <Form.Group className="mb-3">
        <Form.Label>Name *</Form.Label>
        <Form.Control
          value={form.name}
          onChange={handleChange('name')}
          placeholder="e.g. IRSA 1"
          autoFocus
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={form.description}
          onChange={handleChange('description')}
          placeholder="Optional — building, floor, capacity, etc."
        />
      </Form.Group>

      <Form.Group className="mb-0">
        <Form.Label>Biometric machine serial</Form.Label>
        <Form.Control
          value={form.biometric_machine_serial_number}
          onChange={handleChange('biometric_machine_serial_number')}
          placeholder="Optional — serial of the device installed here"
        />
        <Form.Text className="text-muted">
          Used to match biometric punches to this location once the biometric
          integration ships.
        </Form.Text>
      </Form.Group>
    </StandardModal>
  );
};

LocationModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
  location: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    biometric_machine_serial_number: PropTypes.string,
  }),
};
LocationModal.defaultProps = {
  location: null,
};

export default LocationModal;
