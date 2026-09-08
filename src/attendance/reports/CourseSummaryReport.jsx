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
import SectionHeading from '../../shared/SectionHeading';
import './CourseSummaryReport.scss';

// ─── Cell renderers ──────────────────────────────────────────────────────────

const LearnerCell = ({ row }) => (
  <div>
    <div className="attendance-report__learner-cell">
      <span>{row.original.full_name || row.original.email}</span>
      {row.original.is_at_risk && (
        <Badge variant="danger" className="attendance-report__risk-badge">At Risk</Badge>
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
  const tone = row.original.is_at_risk ? 'text-danger' : 'text-success';
  return (
    <span className={`font-weight-bold ${tone}`}>{pct}%</span>
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

const InfoTip = ({ id, text }) => (
  <OverlayTrigger
    trigger={['hover', 'focus']}
    placement="top"
    overlay={<Tooltip id={id}>{text}</Tooltip>}
  >
    <span className="attendance-report__info-tip">
      <Icon src={InfoOutline} className="attendance-report__info-icon" />
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
      <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-sm-between mb-4">
        <h3 className="mb-2 mb-sm-0">Attendance Dashboard</h3>
        <Button
          variant="outline-primary"
          size="sm"
          iconAfter={Download}
          onClick={handleExport}
          disabled={exporting}
          className="flex-shrink-0"
        >
          {exporting ? <Spinner animation="border" size="sm" /> : 'Export Attendance Report'}
        </Button>
      </div>

      {/* ── Section 1: Settings ── */}
      <div className="mb-5">
        <SectionHeading>Settings</SectionHeading>

        <div className="attendance-report__setting-row mb-2">
          <div className="attendance-report__setting-label">
            <span>Attendance threshold:</span>
            <InfoTip
              id="tip-threshold"
              text="Learners whose attendance rate falls below this percentage are flagged as at-risk."
            />
          </div>
          <div className="attendance-report__setting-field">
            <Form.Control
              type="number"
              min={0}
              max={100}
              value={thresholdValue}
              onChange={(e) => { setThresholdSaved(false); setThresholdValue(Number(e.target.value)); }}
              className="attendance-report__setting-input"
              aria-label="Attendance threshold percent"
              disabled={thresholdSaving}
            />
            <span>%</span>
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
          {thresholdSaved && <Badge variant="success">Saved</Badge>}
          {thresholdError && <Badge variant="danger">{thresholdError}</Badge>}
        </div>

        <div className="attendance-report__setting-row">
          <div className="attendance-report__setting-label">
            <span>Marking window:</span>
            <InfoTip
              id="tip-marking-window"
              text="Number of days after a session ends during which admins can still mark attendance. After this window closes, the roster becomes read-only."
            />
          </div>
          <div className="attendance-report__setting-field">
            <Form.Control
              type="number"
              min={0}
              value={markingWindowValue}
              onChange={(e) => { setMarkingWindowSaved(false); setMarkingWindowValue(Number(e.target.value)); }}
              className="attendance-report__setting-input"
              aria-label="Marking window days"
              disabled={markingWindowSaving}
            />
            <span>days</span>
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
          {markingWindowSaved && <Badge variant="success">Saved</Badge>}
          {markingWindowError && <Badge variant="danger">{markingWindowError}</Badge>}
        </div>
      </div>

      {/* ── Section 2: Attendance Summary ── */}
      <div>
        <SectionHeading>Attendance Summary</SectionHeading>
        <p className="text-muted small mb-3">
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

        <div className="attendance-report__course-picker mb-4">
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
            <div className="attendance-report__filters mb-3">
              {[
                {
                  key: 'all', tone: 'all', label: 'All', count: rows.length,
                },
                {
                  key: 'is_at_risk', tone: 'at-risk', label: 'At Risk', count: atRiskCount,
                },
              ].map(({
                key, tone, label, count,
              }) => {
                const active = filterMode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilterMode(key)}
                    className={`attendance-report__filter-pill attendance-report__filter-pill--${tone}${active ? ' attendance-report__filter-pill--active' : ''}`}
                  >
                    {label}
                    <span className="attendance-report__filter-count">
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
