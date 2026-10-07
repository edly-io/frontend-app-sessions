import React from 'react';
import PropTypes from 'prop-types';
import { useIntl } from '@edx/frontend-platform/i18n';
import { Form, Icon, IconButton } from '@openedx/paragon';
import { Add, Remove } from '@openedx/paragon/icons';
import messages from './messages';
import './requests.scss';

// Leave-threshold number field with − / + steppers, built on Paragon's
// Form.Control leading/trailing decorators.
const ThresholdControl = ({
  id, value, onChange, min, disabled,
}) => {
  const intl = useIntl();
  const numeric = value === '' ? min : Number(value);
  const step = (delta) => onChange(Math.max(min, numeric + delta));

  return (
    <Form.Group controlId={id} className="mb-0">
      <Form.Label>Leave threshold (days)</Form.Label>
      <Form.Control
        type="number"
        min={min}
        step={1}
        inputMode="numeric"
        value={value}
        disabled={disabled}
        // className lands on Paragon's decorator wrapper, controlClassName on the <input>.
        className="requests-threshold"
        controlClassName="requests-threshold__input text-center"
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        leadingElement={(
          <IconButton
            src={Remove}
            iconAs={Icon}
            alt="Decrease threshold"
            size="sm"
            onClick={() => step(-1)}
            disabled={disabled || numeric <= min}
          />
        )}
        trailingElement={(
          <IconButton
            src={Add}
            iconAs={Icon}
            alt="Increase threshold"
            size="sm"
            onClick={() => step(1)}
            disabled={disabled}
          />
        )}
      />
      <Form.Control.Feedback type="default">
        {intl.formatMessage(messages.leaveThresholdHelp)}
      </Form.Control.Feedback>
    </Form.Group>
  );
};

ThresholdControl.propTypes = {
  id: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.number,
  disabled: PropTypes.bool,
};

ThresholdControl.defaultProps = {
  id: 'leave-threshold',
  min: 0,
  disabled: false,
};

export default ThresholdControl;
