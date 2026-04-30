// LocationsPage — admin CRUD for the global Location catalogue.
// Visible inside the sessions-admin shell at /sessions/:programId/locations.

import React, { useState } from 'react';
import {
  Alert, Button, Container, DataTable, Spinner, StandardModal, Toast,
} from '@openedx/paragon';
import { Add, DeleteOutline, EditOutline } from '@openedx/paragon/icons';
import PropTypes from 'prop-types';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';

import { useLocations } from '../app/hooks';
import { deleteLocation } from './api';
import { extractApiError } from '../shared/utils';
import LocationModal from './LocationModal';

const DescriptionCell = ({ value }) => (
  value ? <span>{value}</span> : <span className="text-muted">—</span>
);
DescriptionCell.propTypes = { value: PropTypes.string };
DescriptionCell.defaultProps = { value: '' };

const SerialCell = ({ value }) => (
  value ? <code>{value}</code> : <span className="text-muted">—</span>
);
SerialCell.propTypes = { value: PropTypes.string };
SerialCell.defaultProps = { value: '' };

// react-table passes the column definition through as `column`, so callbacks
// and flags hang off the column rather than being closed-over inside the Cell.
// That keeps the Cell module-scoped (no nested-component lint warning).
const ActionsCell = ({ row, column }) => {
  const { isAdmin, onEdit, onDelete } = column;
  if (!isAdmin) { return null; }
  return (
    <div className="d-flex" style={{ gap: 4 }}>
      <Button
        variant="tertiary"
        size="sm"
        iconBefore={EditOutline}
        onClick={() => onEdit(row.original)}
      >
        Edit
      </Button>
      <Button
        variant="tertiary"
        size="sm"
        iconBefore={DeleteOutline}
        style={{ color: '#dc3545' }}
        onClick={() => onDelete(row.original)}
      >
        Delete
      </Button>
    </div>
  );
};
ActionsCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
    }).isRequired,
  }).isRequired,
  column: PropTypes.shape({
    isAdmin: PropTypes.bool.isRequired,
    onEdit: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
  }).isRequired,
};

const LocationsPage = () => {
  const isAdmin = Boolean(getAuthenticatedUser()?.administrator);
  const {
    locations, loading, error, refresh,
  } = useLocations();

  const [editTarget, setEditTarget] = useState(null); // null = create, object = edit
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  if (!isAdmin) {
    return (
      <Container className="py-4">
        <Alert variant="info">This page is for admins only.</Alert>
      </Container>
    );
  }

  const openCreate = () => {
    setEditTarget(null);
    setModalOpen(true);
  };
  const openEdit = (location) => {
    setEditTarget(location);
    setModalOpen(true);
  };
  const handleSaved = (saved) => {
    setModalOpen(false);
    refresh();
    setToast(editTarget ? `Updated ${saved.name}.` : `Created ${saved.name}.`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) { return; }
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteLocation(deleteTarget.id);
      const { name } = deleteTarget;
      setDeleteTarget(null);
      refresh();
      setToast(`Deleted ${name}.`);
    } catch (err) {
      setDeleteError(extractApiError(err, 'Failed to delete location'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { Header: 'Name', accessor: 'name' },
    { Header: 'Description', accessor: 'description', Cell: DescriptionCell },
    { Header: 'Biometric serial', accessor: 'biometric_machine_serial_number', Cell: SerialCell },
    {
      Header: 'Actions',
      id: 'actions',
      Cell: ActionsCell,
      // Custom keys are passed through to the Cell via the `column` arg.
      isAdmin,
      onEdit: openEdit,
      onDelete: setDeleteTarget,
    },
  ];

  return (
    <Container className="py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Locations</h2>
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>
            Physical venues where in-person sessions are held. Create them once
            here, then pick one when scheduling a meeting.
          </p>
        </div>
        <Button variant="primary" iconBefore={Add} onClick={openCreate}>
          New location
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-3">{error}</Alert>
      )}

      {loading ? (
        <div className="py-5 text-center">
          <Spinner animation="border" screenReaderText="Loading locations" />
        </div>
      ) : (
        <DataTable
          data={locations}
          columns={columns}
          itemCount={locations.length}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No locations yet — click 'New location' to add one." />
        </DataTable>
      )}

      <LocationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        location={editTarget}
        onSuccess={handleSaved}
      />

      {deleteTarget && (
        <StandardModal
          isOpen
          onClose={() => { setDeleteTarget(null); setDeleteError(''); }}
          title="Delete location"
          footerNode={(
            <>
              <Button
                variant="tertiary"
                onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleting} className="ml-2">
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </>
          )}
        >
          {deleteError && <Alert variant="danger" className="mb-3">{deleteError}</Alert>}
          <p>
            Delete <strong>{deleteTarget.name}</strong>? The backend will block this if any
            sessions still reference it.
          </p>
        </StandardModal>
      )}

      <div
        style={{
          position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
        }}
        aria-live="polite"
      >
        <Toast show={Boolean(toast)} onClose={() => setToast('')} delay={3500} autohide>
          {toast}
        </Toast>
      </div>
    </Container>
  );
};

export default LocationsPage;
