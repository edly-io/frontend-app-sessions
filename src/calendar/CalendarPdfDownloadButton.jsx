import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Spinner } from '@openedx/paragon';
import { Download } from '@openedx/paragon/icons';
import { buildCalendarPdfModel, buildPdfFilename } from './calendarPdfData';

/**
 * Downloads the sessions currently in view as a timetable PDF.
 *
 * @react-pdf/renderer and its font/layout engine are a large bundle, so they are
 * imported on first click rather than at module load; the calendar page itself
 * carries none of that weight.
 */
const CalendarPdfDownloadButton = ({
  sessions, rangeLabel, viewLabel, programName, sessionTypeLabels,
}) => {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const hasSessions = sessions.length > 0;

  const handleDownload = async () => {
    setGenerating(true);
    setError('');
    try {
      const [{ pdf }, { default: CalendarPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./CalendarPdfDocument'),
      ]);
      const model = buildCalendarPdfModel({
        sessions, rangeLabel, viewLabel, programName, sessionTypeLabels,
      });
      const blob = await pdf(<CalendarPdfDocument model={model} />).toBlob();
      // Same anchor-click download the attendance export uses.
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildPdfFilename(rangeLabel);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Could not generate the PDF. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const label = hasSessions
    ? `Download the ${rangeLabel} timetable as a PDF`
    : 'No sessions in this period to download';

  return (
    <>
      <Button
        variant="outline-primary"
        size="sm"
        iconBefore={generating ? undefined : Download}
        onClick={handleDownload}
        disabled={!hasSessions || generating}
        aria-label={label}
        title={label}
        aria-busy={generating}
      >
        {generating && (
          <Spinner animation="border" size="sm" className="mr-2" screenReaderText="Generating PDF" />
        )}
        {generating ? 'Preparing PDF…' : 'Download PDF'}
      </Button>
      {/* Progress is announced without moving focus away from the button. The
          failure message is visible and announced by its own live region, so it
          is not repeated here. */}
      <span className="sr-only" role="status" aria-live="polite">
        {generating ? 'Generating the timetable PDF' : ''}
      </span>
      {error && <span className="text-danger small ml-2" role="alert">{error}</span>}
    </>
  );
};

CalendarPdfDownloadButton.propTypes = {
  sessions: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  })).isRequired,
  rangeLabel: PropTypes.string.isRequired,
  viewLabel: PropTypes.string,
  programName: PropTypes.string,
  sessionTypeLabels: PropTypes.objectOf(PropTypes.string),
};

CalendarPdfDownloadButton.defaultProps = {
  viewLabel: '',
  programName: '',
  sessionTypeLabels: {},
};

export default CalendarPdfDownloadButton;
