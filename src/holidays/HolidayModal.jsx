// HolidayModal — create + edit. `holiday` prop null → create mode.

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Button, Form, StandardModal,
} from '@openedx/paragon';

import { createHoliday, updateHoliday } from './api';
import { extractApiError } from '../shared/utils';

const emptyForm = {
  name: '', startDate: '', endDate: '', description: '',
};

const HolidayModal = ({
  isOpen, onClose, holiday, onSuccess,
}) => {
  const isEdit = Boolean(holiday);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) { return; }
    setError('');
    setForm(holiday ? {
      name: holiday.name || '',
      startDate: holiday.start_date || '',
      endDate: holiday.end_date || '',
      description: holiday.description || '',
    } : emptyForm);
  }, [isOpen, holiday]);

  const handleChange = (field) => (e) => {
    const { value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-sync: keep end_date >= start_date
      if (field === 'startDate' && (!next.endDate || next.endDate < value)) {
        next.endDate = value;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!form.startDate) {
      setError('Start date is required');
      return;
    }
    if (!form.endDate) {
      setError('End date is required');
      return;
    }
    if (form.endDate < form.startDate) {
      setError('End date must be on or after start date');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        start_date: form.startDate,
        end_date: form.endDate,
        description: form.description,
      };
      const result = isEdit
        ? await updateHoliday(holiday.id, payload)
        : await createHoliday(payload);
      onSuccess(result);
    } catch (err) {
      setError(extractApiError(err, 'Failed to save holiday'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <StandardModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit holiday' : 'New holiday'}
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
          placeholder="e.g. Eid al-Fitr"
          autoFocus
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Start Date *</Form.Label>
        <Form.Control
          type="date"
          value={form.startDate}
          onChange={handleChange('startDate')}
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>End Date *</Form.Label>
        <Form.Control
          type="date"
          value={form.endDate}
          onChange={handleChange('endDate')}
          min={form.startDate}
        />
      </Form.Group>

      <Form.Group className="mb-0">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={form.description}
          onChange={handleChange('description')}
          placeholder="Optional notes"
        />
      </Form.Group>
    </StandardModal>
  );
};

HolidayModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func.isRequired,
  holiday: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string,
    start_date: PropTypes.string,
    end_date: PropTypes.string,
    description: PropTypes.string,
  }),
};
HolidayModal.defaultProps = {
  holiday: null,
};

export default HolidayModal;
