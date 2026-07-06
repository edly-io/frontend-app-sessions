import React, {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import {
  Alert, Badge, Button, Container, DataTable, Form, Icon, OverlayTrigger, Spinner, Tooltip,
} from '@openedx/paragon';
import { Download, InfoOutline } from '@openedx/paragon/icons';
import { useQueryClient } from '@tanstack/react-query';

import SearchableSelect from '../../shared/SearchableSelect';
import { fetchProgramCourses } from '../../calendar/api';
import { useConfig } from '../../app/useConfig';
import {
  exportProgramAttendance,
  getAttendanceSettings,
  getCourseSummary,
  updateAttendanceSettings,
} from '../api';
import { extractApiError } from '../../shared/utils';

// ─── Cell renderers ──────────────────────────────────────────────────────────

const LearnerCell = ({ row }) => (
  <div>
    <div className="d-flex align-items-center" style={{ gap: 6 }}>
      <span>{row.original.full_name || row.original.email}</span>
      {row.original.is_at_risk && (
        <Badge variant="danger" style={{ fontSize: 10 }}>At Risk</Badge>
      )}
    </div>
    {row.original.full_name && (
      <small className="text-muted">{row.original.email}</small>
    )}
  </div>
);
LearnerCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      full_name: PropTypes.string,
      email: PropTypes.string,
      is_at_risk: PropTypes.bool,
    }),
  }).isRequired,
};

const RateCell = ({ row }) => {
  const pct = Math.round(row.original.attendance_rate ?? 0);
  const color = row.original.is_at_risk ? '#dc2626' : '#16a34a';
  return (
    <span style={{ color, fontWeight: 600 }}>{pct}%</span>
  );
};
RateCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      attendance_rate: PropTypes.number,
      is_at_risk: PropTypes.bool,
    }),
  }).isRequired,
};

const CX = { cellClassName: 'text-center', headerClassName: 'justify-content-center' };

const SectionHeading = ({ children }) => (
  <h3 style={{
    fontSize: 19,
    fontWeight: 700,
    color: '#1e40af',
    borderBottom: '2px solid #bfdbfe',
    paddingBottom: 10,
    marginBottom: 20,
    marginTop: 0,
    letterSpacing: '-0.01em',
  }}
  >
    {children}
  </h3>
);
SectionHeading.propTypes = { children: PropTypes.node.isRequired };

const InfoTip = ({ id, text }) => (
  <OverlayTrigger
    trigger={['hover', 'focus']}
    placement="top"
    overlay={<Tooltip id={id}>{text}</Tooltip>}
  >
    <span style={{ cursor: 'default', lineHeight: 0 }}>
      <Icon src={InfoOutline} style={{ width: 16, height: 16, color: '#6b7280' }} />
    </span>
  </OverlayTrigger>
);
InfoTip.propTypes = { id: PropTypes.string.isRequired, text: PropTypes.string.isRequired };

const COLUMNS = [
  { Header: 'Learner', accessor: 'full_name', Cell: LearnerCell },
  { Header: 'Sessions', accessor: 'total', ...CX },
  { Header: 'Present', accessor: 'present', ...CX },
  { Header: 'Absent', accessor: 'absent', ...CX },
  { Header: 'Leave', accessor: 'leave', ...CX },
  { Header: 'Pending', accessor: 'pending', ...CX },
  {
    Header: 'Attendance %', accessor: 'attendance_rate', Cell: RateCell, ...CX,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

const CourseSummaryReport = () => {
  const { programId } = useParams();
  const queryClient = useQueryClient();
  const { data: config } = useConfig();

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [rows, setRows] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'is_at_risk'

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  // Attendance threshold setting
  const [thresholdValue, setThresholdValue] = useState(0);
  const [committedThreshold, setCommittedThreshold] = useState(null);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [thresholdError, setThresholdError] = useState('');

  // Marking window setting
  const [markingWindowValue, setMarkingWindowValue] = useState(7);
  const [committedMarkingWindow, setCommittedMarkingWindow] = useState(null);
  const [markingWindowSaving, setMarkingWindowSaving] = useState(false);
  const [markingWindowSaved, setMarkingWindowSaved] = useState(false);
  const [markingWindowError, setMarkingWindowError] = useState('');

  // Seed from config (all-user endpoint) on first load before /settings/ responds
  useEffect(() => {
    if (committedThreshold === null && config?.at_risk_threshold_percent != null) {
      setThresholdValue(config.at_risk_threshold_percent);
      setCommittedThreshold(config.at_risk_threshold_percent);
    }
    if (committedMarkingWindow === null && config?.marking_window_days != null) {
      setMarkingWindowValue(config.marking_window_days);
      setCommittedMarkingWindow(config.marking_window_days);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.at_risk_threshold_percent, config?.marking_window_days]);

  // Authoritative read from /settings/ (admin-only), overwrites config seed
  useEffect(() => {
    getAttendanceSettings()
      .then((s) => {
        setThresholdValue(s.at_risk_threshold_percent ?? 0);
        setMarkingWindowValue(s.marking_window_days ?? 7);
        setCommittedThreshold(s.at_risk_threshold_percent ?? 0);
        setCommittedMarkingWindow(s.marking_window_days ?? 7);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!programId) { return () => {}; }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchProgramCourses(programId);
        if (cancelled) { return; }
        setCourses((data || []).map((c) => ({ id: c.course_key, title: c.display_name })));
      } catch (err) {
        if (!cancelled) { setCoursesError(extractApiError(err, 'Failed to load courses')); }
      } finally {
        if (!cancelled) { setCoursesLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [programId]);

  const loadSummary = useCallback(async (courseId) => {
    if (!courseId) { return; }
    setSummaryLoading(true);
    setSummaryError('');
    setRows([]);
    setFilterMode('all');
    try {
      const data = await getCourseSummary(courseId, programId);
      setRows(Array.isArray(data) ? data : data.results ?? []);
    } catch (err) {
      setSummaryError(extractApiError(err, 'Failed to load summary'));
    } finally {
      setSummaryLoading(false);
    }
  }, [programId]);

  const handleCourseChange = (option) => {
    const courseId = option?.value || '';
    setSelectedCourseId(courseId);
    setRows([]);
    if (courseId) { loadSummary(courseId); }
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError('');
    try {
      await exportProgramAttendance(programId);
    } catch (err) {
      setExportError(extractApiError(err, 'Export failed'));
    } finally {
      setExporting(false);
    }
  };

  const handleThresholdSave = async () => {
    setThresholdSaving(true);
    setThresholdSaved(false);
    setThresholdError('');
    try {
      await updateAttendanceSettings({ at_risk_threshold_percent: thresholdValue });
      setCommittedThreshold(thresholdValue);
      await queryClient.invalidateQueries({ queryKey: ['config'] });
      setThresholdSaved(true);
    } catch {
      setThresholdError('Failed to save.');
    } finally {
      setThresholdSaving(false);
    }
  };

  const handleMarkingWindowSave = async () => {
    setMarkingWindowSaving(true);
    setMarkingWindowSaved(false);
    setMarkingWindowError('');
    try {
      await updateAttendanceSettings({ marking_window_days: markingWindowValue });
      setCommittedMarkingWindow(markingWindowValue);
      await queryClient.invalidateQueries({ queryKey: ['config'] });
      setMarkingWindowSaved(true);
    } catch {
      setMarkingWindowError('Failed to save.');
    } finally {
      setMarkingWindowSaving(false);
    }
  };

  const thresholdChanged = committedThreshold !== null && thresholdValue !== committedThreshold;
  const markingWindowChanged = committedMarkingWindow !== null && markingWindowValue !== committedMarkingWindow;

  const atRiskCount = useMemo(() => rows.filter((r) => r.is_at_risk).length, [rows]);
  const tableData = useMemo(
    () => (filterMode === 'is_at_risk' ? rows.filter((r) => r.is_at_risk) : rows),
    [rows, filterMode],
  );

  const courseOptions = useMemo(() => courses.map((c) => ({
    value: c.id,
    label: c.title || `Course ${c.id}`,
  })), [courses]);

  const selectedCourseOption = useMemo(() => (
    courseOptions.find((o) => o.value === selectedCourseId) || null
  ), [courseOptions, selectedCourseId]);

  return (
    <Container className="py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="mb-0">Attendance Dashboard</h3>
        <Button
          variant="outline-primary"
          size="sm"
          iconAfter={Download}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? <Spinner animation="border" size="sm" /> : 'Export XLSX'}
        </Button>
      </div>

      {/* ── Section 1: Settings ── */}
      <div className="mb-5">
        <SectionHeading>Settings</SectionHeading>

        <div className="d-flex align-items-center mb-2" style={{ gap: 12 }}>
          <div className="d-flex align-items-center" style={{ gap: 5, minWidth: 180 }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>Attendance threshold:</span>
            <InfoTip
              id="tip-threshold"
              text="Learners whose attendance rate falls below this percentage are flagged as at-risk."
            />
          </div>
          <div className="d-flex align-items-center" style={{ gap: 4 }}>
            <Form.Control
              type="number"
              min={0}
              max={100}
              value={thresholdValue}
              onChange={(e) => { setThresholdSaved(false); setThresholdValue(Number(e.target.value)); }}
              style={{ width: 72 }}
              aria-label="Attendance threshold percent"
              disabled={thresholdSaving}
            />
            <span style={{ fontSize: 14 }}>%</span>
          </div>
          {thresholdChanged && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleThresholdSave}
              disabled={thresholdSaving}
            >
              {thresholdSaving ? <Spinner animation="border" size="sm" /> : 'Save'}
            </Button>
          )}
          {thresholdSaved && <small style={{ color: '#16a34a' }}>Saved</small>}
          {thresholdError && <small style={{ color: '#dc2626' }}>{thresholdError}</small>}
        </div>

        <div className="d-flex align-items-center" style={{ gap: 12 }}>
          <div className="d-flex align-items-center" style={{ gap: 5, minWidth: 180 }}>
            <span style={{ fontWeight: 500, fontSize: 14 }}>Marking window:</span>
            <InfoTip
              id="tip-marking-window"
              text="Number of days after a session ends during which admins can still mark attendance. After this window closes, the roster becomes read-only."
            />
          </div>
          <div className="d-flex align-items-center" style={{ gap: 4 }}>
            <Form.Control
              type="number"
              min={0}
              value={markingWindowValue}
              onChange={(e) => { setMarkingWindowSaved(false); setMarkingWindowValue(Number(e.target.value)); }}
              style={{ width: 72 }}
              aria-label="Marking window days"
              disabled={markingWindowSaving}
            />
            <span style={{ fontSize: 14 }}>days</span>
          </div>
          {markingWindowChanged && (
            <Button
              variant="outline-primary"
              size="sm"
              onClick={handleMarkingWindowSave}
              disabled={markingWindowSaving}
            >
              {markingWindowSaving ? <Spinner animation="border" size="sm" /> : 'Save'}
            </Button>
          )}
          {markingWindowSaved && <small style={{ color: '#16a34a' }}>Saved</small>}
          {markingWindowError && <small style={{ color: '#dc2626' }}>{markingWindowError}</small>}
        </div>
      </div>

      {/* ── Section 2: Attendance Summary ── */}
      <div>
        <SectionHeading>Attendance Summary</SectionHeading>
        <p className="text-muted mb-3">
          Aggregated attendance per learner for a course — present / absent / leave /
          pending counts and attendance percentage across all completed sessions.
        </p>

        {coursesError && (
          <Alert variant="danger" dismissible onClose={() => setCoursesError('')}>
            {coursesError}
          </Alert>
        )}
        {summaryError && (
          <Alert variant="danger" dismissible onClose={() => setSummaryError('')}>
            {summaryError}
          </Alert>
        )}
        {exportError && (
          <Alert variant="danger" dismissible onClose={() => setExportError('')}>
            {exportError}
          </Alert>
        )}

        <div className="mb-4" style={{ minWidth: 280, maxWidth: 400 }}>
          <SearchableSelect
            id="summary-course"
            label="Course"
            options={courseOptions}
            value={selectedCourseOption}
            onChange={handleCourseChange}
            loading={coursesLoading}
            placeholder="Search courses…"
          />
        </div>

        {!selectedCourseId && !coursesLoading && (
          <Alert variant="info">Select a course to see the attendance summary.</Alert>
        )}

        {selectedCourseId && summaryLoading && (
          <div className="text-center py-4">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">Loading summary…</p>
          </div>
        )}

        {selectedCourseId && !summaryLoading && rows.length === 0 && (
          <Alert variant="info">No attendance data for this course yet.</Alert>
        )}

        {selectedCourseId && !summaryLoading && rows.length > 0 && (
          <>
            <div className="d-flex align-items-center mb-3" style={{ gap: 6 }}>
              {[
                {
                  key: 'all', label: 'All', count: rows.length, activeColor: '#2563eb',
                },
                {
                  key: 'is_at_risk', label: 'At Risk', count: atRiskCount, activeColor: '#dc2626',
                },
              ].map(({
                key, label, count, activeColor,
              }) => {
                const active = filterMode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterMode(key)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 20,
                      border: `1.5px solid ${active ? activeColor : '#d1d5db'}`,
                      background: active ? activeColor : '#fff',
                      color: active ? '#fff' : '#374151',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      lineHeight: 1.4,
                    }}
                  >
                    {label}
                    <span style={{ marginLeft: 6, opacity: 0.85, fontWeight: 400 }}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            {tableData.length === 0 ? (
              <Alert variant="info">No at-risk learners for this course.</Alert>
            ) : (
              <DataTable
                isSortable
                data={tableData}
                columns={COLUMNS}
                itemCount={tableData.length}
                initialState={{ sortBy: [{ id: 'attendance_rate', desc: false }] }}
              >
                <DataTable.Table />
                <DataTable.EmptyTable content="No learners" />
              </DataTable>
            )}
          </>
        )}
      </div>
    </Container>
  );
};

export default CourseSummaryReport;
