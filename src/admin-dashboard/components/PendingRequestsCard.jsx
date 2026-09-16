import React from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Card, Icon,
} from '@openedx/paragon';
import {
  CheckCircle, EventNote, SwapHoriz, Wifi,
} from '@openedx/paragon/icons';
import { Link } from 'react-router-dom';

const groupByProgram = (requests) => {
  const groups = {};
  requests.forEach((r) => {
    const key = r.program_key;
    if (!groups[key]) {
      groups[key] = { program_key: key, program_name: r.program_name, count: 0 };
    }
    groups[key].count += 1;
  });
  return Object.values(groups);
};

const RequestTypeSection = ({
  icon, label, groups, basePath,
}) => (
  <div className="admin-dashboard__request-type-section">
    <div className="admin-dashboard__request-type-header">
      <span className="admin-dashboard__request-icon"><Icon src={icon} /></span>
      <strong>{label}</strong>
    </div>
    <div className="admin-dashboard__request-program-list">
      {groups.map((group) => (
        <div className="admin-dashboard__request-program-row" key={group.program_key}>
          <span className="admin-dashboard__request-program-name">
            {group.program_name || group.program_key}
          </span>
          <span className="admin-dashboard__request-program-count">
            {group.count} pending
          </span>
          <Link
            to={`/${group.program_key}/${basePath}`}
            className="btn btn-outline-secondary btn-sm"
          >
            Review →
          </Link>
        </div>
      ))}
    </div>
  </div>
);

RequestTypeSection.propTypes = {
  icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  groups: PropTypes.arrayOf(PropTypes.shape({
    program_key: PropTypes.string.isRequired,
    program_name: PropTypes.string,
    count: PropTypes.number.isRequired,
  })).isRequired,
  basePath: PropTypes.string.isRequired,
};

const PendingRequestsCard = ({ requests }) => {
  const leaveCount = requests?.leave_count ?? 0;
  const remoteCount = requests?.remote_session_count ?? 0;
  const substituteCount = requests?.substitute_count ?? 0;
  const total = leaveCount + remoteCount + substituteCount;

  const leaveGroups = groupByProgram(requests?.leave_requests ?? []);
  const remoteGroups = groupByProgram(requests?.remote_requests ?? []);
  const substituteGroups = groupByProgram(requests?.substitute_requests ?? []);

  return (
    <Card>
      <Card.Header
        title={<h2>Pending Requests</h2>}
        subtitle={`${total} request${total !== 1 ? 's' : ''} awaiting review`}
      />
      <Card.Section>
        {total === 0 ? (
          <Alert variant="success" icon={CheckCircle}>
            <Alert.Heading>All caught up</Alert.Heading>
            No pending requests to review.
          </Alert>
        ) : (
          <div className="admin-dashboard__request-list">
            {leaveGroups.length > 0 && (
              <RequestTypeSection
                icon={EventNote}
                label="Leave Requests"
                groups={leaveGroups}
                basePath="requests/leaves"
              />
            )}
            {remoteGroups.length > 0 && (
              <RequestTypeSection
                icon={Wifi}
                label="Remote Session Requests"
                groups={remoteGroups}
                basePath="requests/remote-sessions"
              />
            )}
            {substituteGroups.length > 0 && (
              <RequestTypeSection
                icon={SwapHoriz}
                label="Substitute Requests"
                groups={substituteGroups}
                basePath="requests/substitute-requests"
              />
            )}
          </div>
        )}
      </Card.Section>
    </Card>
  );
};

PendingRequestsCard.propTypes = {
  requests: PropTypes.shape({
    leave_count: PropTypes.number,
    remote_session_count: PropTypes.number,
    substitute_count: PropTypes.number,
    leave_requests: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      program_key: PropTypes.string,
      program_name: PropTypes.string,
    })),
    remote_requests: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      program_key: PropTypes.string,
      program_name: PropTypes.string,
    })),
    substitute_requests: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.string,
      program_key: PropTypes.string,
      program_name: PropTypes.string,
    })),
  }),
};

PendingRequestsCard.defaultProps = {
  requests: null,
};

export default PendingRequestsCard;
