// LocationsPage — admin CRUD for the global Location catalogue.
// Visible inside the sessions-admin shell at /sessions/:programId/locations.

import React, {
  useState, useEffect, useCallback, useMemo,
} from 'react';
import {
  Alert, Button, Container, DataTable, Form, Spinner, StandardModal, Toast,
} from '@openedx/paragon';
import { Add, DeleteOutline, EditOutline } from '@openedx/paragon/icons';
import PropTypes from 'prop-types';
import { useConfig } from '../app/useConfig';
import { USER_ROLE } from '../shared/constants';
import { getLocations, deleteLocation } from './api';
import { extractApiError } from '../shared/utils';
import LocationModal from './LocationModal';
import useModalParams from '../shared/useModalParams';

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

const PAGE_SIZE = 20;

const LocationsPage = () => {
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;

  const [locations, setLocations] = useState([]);
  const [count, setCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const {
    modal, modalId, openModal, closeModal,
  } = useModalParams();
  const isLocationModalOpen = modal === 'new-location' || modal === 'edit-location';
  const editTarget = modal === 'edit-location' && modalId
    ? locations.find((l) => String(l.id) === String(modalId)) ?? null
    : null;
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchData = useCallback(async ({ pageIndex: nextIndex = 0 } = {}) => {
    setCurrentPage(nextIndex);
    setError('');
    try {
      const { count: total, results } = await getLocations({
        search: debouncedSearch,
        page: nextIndex + 1,
        pageSize: PAGE_SIZE,
      });
      setLocations(results);
      setCount(total);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load locations'));
    } finally {
      setInitialLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { fetchData({ pageIndex: 0 }); }, [fetchData]);

  /* eslint-disable react/no-unstable-nested-components, react/prop-types */
  const columns = useMemo(() => [
    { Header: 'Name', accessor: 'name' },
    { Header: 'Description', accessor: 'description', Cell: DescriptionCell },
    { Header: 'Biometric serial', accessor: 'biometric_machine_serial_number', Cell: SerialCell },
    {
      Header: 'Actions',
      id: 'actions',
      Cell: ActionsCell,
      isAdmin,
      onEdit: (loc) => openModal('edit-location', loc.id),
      onDelete: setDeleteTarget,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [isAdmin, openModal]);
  /* eslint-enable react/no-unstable-nested-components, react/prop-types */

  if (!isAdmin) {
    return (
      <Container className="py-4">
        <Alert variant="info">This page is for admins only.</Alert>
      </Container>
    );
  }

  const handleSaved = (saved) => {
    const wasEdit = modal === 'edit-location';
    closeModal();
    fetchData({ pageIndex: currentPage });
    setToast(wasEdit ? `Updated ${saved.name}.` : `Created ${saved.name}.`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) { return; }
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteLocation(deleteTarget.id);
      const { name } = deleteTarget;
      setDeleteTarget(null);
      fetchData({ pageIndex: currentPage });
      setToast(`Deleted ${name}.`);
    } catch (err) {
      setDeleteError(extractApiError(err, 'Failed to delete location'));
    } finally {
      setDeleting(false);
    }
  };

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
        <Button variant="primary" iconBefore={Add} onClick={() => openModal('new-location')}>
          New location
        </Button>
      </div>

      <Form.Control
        type="search"
        placeholder="Search locations…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="mb-3"
        style={{ maxWidth: 320 }}
      />

      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {initialLoading ? (
        <div className="py-5 text-center">
          <Spinner animation="border" screenReaderText="Loading locations" />
        </div>
      ) : (
        <DataTable
          key={debouncedSearch}
          isPaginated
          manualPagination
          fetchData={fetchData}
          pageCount={Math.max(1, Math.ceil(count / PAGE_SIZE))}
          itemCount={count}
          data={locations}
          columns={columns}
          initialState={{ pageIndex: 0, pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No locations found." />
          <DataTable.TableFooter />
        </DataTable>
      )}

      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={closeModal}
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
