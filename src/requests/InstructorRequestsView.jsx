import React from 'react';
import PropTypes from 'prop-types';
import { Container } from '@openedx/paragon';
import { useParams } from 'react-router-dom';
import { REQUEST_TYPE } from '../shared/constants';
import LearnerRequestsView from './LearnerRequestsView';
import SessionLeavesPanel from './SessionLeavesPanel';

const InstructorRequestsView = ({ lockedType }) => {
  const { programId } = useParams();
  return (
    <>
      <LearnerRequestsView lockedType={lockedType} />
      {lockedType === REQUEST_TYPE.LEAVE && (
        <Container className="pb-5">
          <SessionLeavesPanel programKey={programId || ''} />
        </Container>
      )}
    </>
  );
};

InstructorRequestsView.propTypes = {
  lockedType: PropTypes.string,
};

InstructorRequestsView.defaultProps = {
  lockedType: null,
};

export default InstructorRequestsView;
