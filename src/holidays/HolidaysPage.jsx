// HolidaysPage — admin CRUD for public holidays.
// Visible inside the sessions-admin shell at /sessions/:programId/holidays.

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
import { getHolidays, deleteHoliday } from './api';
import { extractApiError } from '../shared/utils';
import HolidayModal from './HolidayModal';
import useModalParams from '../shared/useModalParams';

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

const PAGE_SIZE = 20;

const HolidaysPage = () => {
  const { data: config } = useConfig();
  const isAdmin = config?.user_role === USER_ROLE.ADMIN;

  const [holidays, setHolidays] = useState([]);
  const [count, setCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const {
    modal, modalId, openModal, closeModal,
  } = useModalParams();
  const isHolidayModalOpen = modal === 'new-holiday' || modal === 'edit-holiday';
  const editTarget = modal === 'edit-holiday' && modalId
    ? holidays.find((h) => String(h.id) === String(modalId)) ?? null
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
      const { count: total, results } = await getHolidays({
        search: debouncedSearch,
        page: nextIndex + 1,
        pageSize: PAGE_SIZE,
      });
      setHolidays(results);
      setCount(total);
    } catch (err) {
      setError(extractApiError(err, 'Failed to load holidays'));
    } finally {
      setInitialLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { fetchData({ pageIndex: 0 }); }, [fetchData]);

  /* eslint-disable react/no-unstable-nested-components, react/prop-types */
  const columns = useMemo(() => [
    { Header: 'Name', accessor: 'name' },
    { Header: 'Date Range', id: 'date_range', Cell: DateRangeCell },
    { Header: 'Description', accessor: 'description', Cell: DescriptionCell },
    {
      Header: 'Actions',
      id: 'actions',
      Cell: ActionsCell,
      isAdmin,
      onEdit: (h) => openModal('edit-holiday', h.id),
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
    const wasEdit = modal === 'edit-holiday';
    closeModal();
    fetchData({ pageIndex: currentPage });
    setToast(wasEdit ? `Updated ${saved.name}.` : `Created ${saved.name}.`);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) { return; }
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteHoliday(deleteTarget.id);
      const { name } = deleteTarget;
      setDeleteTarget(null);
      fetchData({ pageIndex: currentPage });
      setToast(`Deleted ${name}.`);
    } catch (err) {
      setDeleteError(extractApiError(err, 'Failed to delete holiday'));
    } finally {
      setDeleting(false);
    }
  };

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
        <Button variant="primary" iconBefore={Add} onClick={() => openModal('new-holiday')}>
          New holiday
        </Button>
      </div>

      <Form.Control
        type="search"
        placeholder="Search holidays…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="mb-3"
        style={{ maxWidth: 320 }}
      />

      {error && <Alert variant="danger" className="mb-3">{error}</Alert>}

      {initialLoading ? (
        <div className="py-5 text-center">
          <Spinner animation="border" screenReaderText="Loading holidays" />
        </div>
      ) : (
        <DataTable
          key={debouncedSearch}
          isPaginated
          manualPagination
          fetchData={fetchData}
          pageCount={Math.max(1, Math.ceil(count / PAGE_SIZE))}
          itemCount={count}
          data={holidays}
          columns={columns}
          initialState={{ pageIndex: 0, pageSize: PAGE_SIZE }}
        >
          <DataTable.Table />
          <DataTable.EmptyTable content="No holidays found." />
          <DataTable.TableFooter />
        </DataTable>
      )}

      <HolidayModal
        isOpen={isHolidayModalOpen}
        onClose={closeModal}
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
