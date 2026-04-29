import React from 'react';
import PropTypes from 'prop-types';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Spinner, Icon } from '@openedx/paragon';
import { KeyboardArrowDown } from '@openedx/paragon/icons';
import { usePrograms } from './hooks';

const Label = ({ text }) => (
  <span
    className="text-muted text-uppercase"
    style={{ fontSize: 11, letterSpacing: '0.08em', fontWeight: 600 }}
  >
    {text}
  </span>
);

Label.propTypes = { text: PropTypes.string.isRequired };

const Stack = ({ children }) => (
  <div className="d-flex flex-column" style={{ gap: 2 }}>{children}</div>
);

Stack.propTypes = { children: PropTypes.node.isRequired };

const ProgramSelector = ({ section }) => {
  const { programs, loading, error } = usePrograms();
  const { programId } = useParams();
  const navigate = useNavigate();

  if (loading) {
    return <Spinner animation="border" size="sm" screenReaderText="Loading programs" />;
  }
  if (error) {
    return <span className="text-danger small">{error}</span>;
  }
  if (!programs.length) {
    return <span className="text-muted small">No programs available.</span>;
  }

  // Single program: dropdown adds no value — render the name as static heading.
  if (programs.length === 1) {
    return (
      <Stack>
        <Label text="Program" />
        <span style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>
          {programs[0].name}
        </span>
      </Stack>
    );
  }

  const onChange = (event) => {
    const next = event.target.value;
    navigate(`/sessions/${next}/${section}`);
  };

  // Multi-program: button-styled select. Padding lives on the select itself
  // so the whole chip is one click target — clicks on the caret area hit the
  // native select and open the dropdown.
  return (
    <Stack>
      <Label text="Select a program" />
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          alignSelf: 'flex-start',
          width: 'fit-content',
        }}
      >
        <Form.Control
          as="select"
          value={programId || ''}
          onChange={onChange}
          aria-label="Program"
          className="program-selector-trigger"
          style={{
            fontSize: 20,
            lineHeight: 1.2,
            color: '#1f2933',
            background: '#fff',
            border: '1px solid #ced4da',
            borderRadius: 6,
            outline: 'none',
            boxShadow: 'none',
            padding: '6px 38px 6px 14px',
            width: 'auto',
            minWidth: 0,
            cursor: 'pointer',
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            height: 'auto',
            transition: 'background 80ms ease-out, border-color 80ms ease-out, box-shadow 80ms ease-out',
          }}
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Form.Control>
        <Icon
          src={KeyboardArrowDown}
          style={{
            position: 'absolute',
            right: 10,
            pointerEvents: 'none',
            width: 22,
            height: 22,
            color: '#1f2933',
          }}
        />
        <style>
          {`
            .program-selector-trigger:hover {
              background: #f5f6f8;
              border-color: #adb5bd;
            }
            .program-selector-trigger:focus {
              border-color: #0d6efd;
              box-shadow: 0 0 0 3px rgba(13, 110, 253, 0.18);
            }
          `}
        </style>
      </span>
    </Stack>
  );
};

ProgramSelector.propTypes = {
  section: PropTypes.oneOf(['calendar', 'requests', 'attendance']).isRequired,
};

export default ProgramSelector;
