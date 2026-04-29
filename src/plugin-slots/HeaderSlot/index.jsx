import PropTypes from 'prop-types';
import Header from '@edx/frontend-component-header';

const HeaderSlot = ({
  courseOrg, courseNumber, courseTitle, showUserDropdown,
}) => (
  <Header
    courseOrg={courseOrg}
    courseNumber={courseNumber}
    courseTitle={courseTitle}
    showUserDropdown={showUserDropdown}
  />
);

HeaderSlot.propTypes = {
  courseOrg: PropTypes.string,
  courseNumber: PropTypes.string,
  courseTitle: PropTypes.string,
  showUserDropdown: PropTypes.bool,
};

HeaderSlot.defaultProps = {
  courseOrg: null,
  courseNumber: null,
  courseTitle: null,
  showUserDropdown: true,
};

export default HeaderSlot;
