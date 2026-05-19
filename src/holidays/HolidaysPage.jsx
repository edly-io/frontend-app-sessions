// HolidaysPage — admin CRUD for public holidays.
// Visible inside the sessions-admin shell at /sessions/:programId/holidays.

import React, { useState } from 'react';
import {
  Alert, Button, Container, DataTable, Spinner, StandardModal, Toast,
} from '@openedx/paragon';
import { Add, DeleteOutline, EditOutline } from '@openedx/paragon/icons';
import PropTypes from 'prop-types';
import { getAuthenticatedUser } from '@edx/frontend-platform/auth';

import { useHolidays } from '../app/hooks';
import { deleteHoliday } from './api';
import { extractApiError } from '../shared/utils';
import HolidayModal from './HolidayModal';

const fmt = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

const DateRangeCell = ({ row }) => {
  const { start_date: start, end_date: end } = row.original;
  if (!start) { return <span className="text-muted">—</span>; }
  return <span>{start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`}</span>;
};
DateRangeCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({ start_date: PropTypes.string, end_date: PropTypes.string }),
  }).isRequired,
};

const DescriptionCell = ({ value }) => (
  value ? <span>{value}</span> : <span className="text-muted">—</span>
);
DescriptionCell.propTypes = { value: PropTypes.string };
DescriptionCell.defaultProps = { value: '' };

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
      id: PropTypes.number,
      name: PropTypes.string,
    }).isRequired,
  }).isRequired,
  column: PropTypes.shape({
    isAdmin: PropTypes.bool.isRequired,
    onEdit: PropTypes.func.isRequired,
    onDelete: PropTypes.func.isRequired,
  }).isRequired,
};

const HolidaysPage = () => {
  const isAdmin = Boolean(getAuthenticatedUser()?.administrator);
  const {
    holidays, loading, error, refresh,
  } = useHolidays();

  const [editTarget, setEditTarget] = useState(null);
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
  const openEdit = (holiday) => {
    setEditTarget(holiday);
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
      await deleteHoliday(deleteTarget.id);
      const { name } = deleteTarget;
      setDeleteTarget(null);
      refresh();
      setToast(`Deleted ${name}.`);
    } catch (err) {
      setDeleteError(extractApiError(err, 'Failed to delete holiday'));
    } finally {
      setDeleting(false);
    }
  };

  const columns = [
    { Header: 'Name', accessor: 'name' },
    { Header: 'Date Range', id: 'date_range', Cell: DateRangeCell },
    { Header: 'Description', accessor: 'description', Cell: DescriptionCell },
    {
      Header: 'Actions',
      id: 'actions',
      Cell: ActionsCell,
      isAdmin,
      onEdit: openEdit,
      onDelete: setDeleteTarget,
    },
  ];

  return (
    <Container className="py-3">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="mb-1">Public Holidays</h2>
          <p className="text-muted mb-0" style={{ fontSize: 13 }}>
            Holidays are shown as banners on the calendar. A soft reminder
            appears when scheduling a session on a holiday or weekend.
          </p>
        </div>
        <Button variant="primary" iconBefore={Add} onClick={openCreate}>
          New holiday
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="mb-3">{error}</Alert>
      )}

      {loading ? (
        <div className="py-5 text-center">
          <Spinner animation="border" screenReaderText="Loading holidays" />
        </div>
      ) : (
        <DataTable
          data={holidays}
          columns={columns}
          itemCount={holidays.length}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No holidays yet — click 'New holiday' to add one." />
        </DataTable>
      )}

      <HolidayModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        holiday={editTarget}
        onSuccess={handleSaved}
      />

      {deleteTarget && (
        <StandardModal
          isOpen
          onClose={() => { setDeleteTarget(null); setDeleteError(''); }}
          title="Delete holiday"
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
            Delete <strong>{deleteTarget.name}</strong>?
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

export default HolidaysPage;
