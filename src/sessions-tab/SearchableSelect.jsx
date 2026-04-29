import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Form, Icon, Spinner, Chip,
} from '@openedx/paragon';
import { Close, Search } from '@openedx/paragon/icons';

/**
 * SearchableSelect
 *
 * Single- or multi-select autocomplete dropdown backed by an in-memory list.
 * Filters options by label as the user types. Supports keyboard navigation
 * (↑ / ↓ / Enter / Escape) and click-outside-to-close.
 *
 * In `multiple` mode selected items render as removable Paragon Chips inside
 * the input wrapper (token-input UX); backspace on an empty query removes
 * the last chip.
 *
 * Props
 * ─────
 *   id          {string}  – wired to the input `id` and label `htmlFor`
 *   label       {string}  – visible form label text
 *   options     {Array}   – [{ value, label, ...extras }] filtered in-memory by label
 *   value       {object|array|null}
 *                 – single mode: selected option object or null
 *                 – multi mode:  array of selected option objects (may be empty)
 *   onChange    {function}
 *                 – single mode: (option | null) → void
 *                 – multi mode:  (nextArray) → void
 *   multiple    {boolean} – enable multi-select / chip UI
 *   placeholder {string}
 *   disabled    {boolean}
 *   loading     {boolean} – shows a spinner in the dropdown while options are fetching
 *   required    {boolean} – appends " *" to the label
 */
const SearchableSelect = ({
  id,
  label,
  options,
  value,
  onChange,
  multiple,
  placeholder,
  disabled,
  loading,
  required,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const isMulti = multiple === true;
  const effectiveValue = value ?? (isMulti ? [] : null);
  let selectedList;
  if (isMulti) {
    selectedList = effectiveValue;
  } else if (effectiveValue) {
    selectedList = [effectiveValue];
  } else {
    selectedList = [];
  }
  const selectedIds = new Set(selectedList.map((o) => o.value));

  // Close the dropdown when the user clicks outside the component
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Single-mode only: keep query in sync when value is cleared externally
  useEffect(() => {
    if (!isMulti && !value) { setQuery(''); }
  }, [value, isMulti]);

  const filteredOptions = options.filter((o) => {
    if (isMulti && selectedIds.has(o.value)) { return false; }
    return o.label.toLowerCase().includes(query.toLowerCase());
  });

  const selectOption = (option) => {
    if (isMulti) {
      onChange([...selectedList, option]);
      setQuery('');
      setFocusedIndex(-1);
      // keep dropdown open for additional picks
      setIsOpen(true);
      inputRef.current?.focus();
      return;
    }
    onChange(option);
    setQuery('');
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const removeSelected = (option) => {
    if (!isMulti) { return; }
    onChange(selectedList.filter((o) => o.value !== option.value));
    inputRef.current?.focus();
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setFocusedIndex(-1);
    // Single mode: typing after a confirmed selection clears the selection
    if (!isMulti && value) { onChange(null); }
  };

  const handleKeyDown = (e) => {
    // Multi-mode: Backspace on empty query removes last chip
    if (isMulti && e.key === 'Backspace' && query === '' && selectedList.length > 0) {
      e.preventDefault();
      removeSelected(selectedList[selectedList.length - 1]);
      return;
    }
    if (!isOpen) {
      if (e.key !== 'Escape') { setIsOpen(true); }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
          selectOption(filteredOptions[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Single mode: show selected label in input; otherwise query
  // Multi mode: input always mirrors query (selections live as chips)
  let inputDisplayValue;
  if (isMulti) {
    inputDisplayValue = query;
  } else if (effectiveValue) {
    inputDisplayValue = effectiveValue.label;
  } else {
    inputDisplayValue = query;
  }

  const inputCommonProps = {
    id,
    type: 'text',
    value: inputDisplayValue,
    onChange: handleInputChange,
    onKeyDown: handleKeyDown,
    placeholder: selectedList.length > 0 && isMulti ? '' : placeholder,
    disabled,
    autoComplete: 'off',
    role: 'combobox',
    'aria-expanded': isOpen,
    'aria-autocomplete': 'list',
    'aria-controls': `${id}-listbox`,
  };

  return (
    <Form.Group className="mb-3">
      <Form.Label htmlFor={id}>
        {label}{required && ' *'}
      </Form.Label>

      <div ref={containerRef} style={{ position: 'relative' }}>
        {isMulti ? (
          <div className="pgn__form-control-decorator-group">
            <div className="pgn__form-control-decorator pgn__form-control-decorator-leading">
              <Icon src={Search} style={{ width: '1rem', height: '1rem' }} />
            </div>
            <div
              onClick={() => { if (!disabled) { setIsOpen(true); inputRef.current?.focus(); } }}
              role="presentation"
              className="form-control h-auto pgn__form-control-decorator-element--leading"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3125rem 0.5rem',
                paddingLeft: '2.5rem',
                backgroundColor: disabled ? '#e9ecef' : '#fff',
                cursor: disabled ? 'not-allowed' : 'text',
              }}
            >
              {selectedList.map((opt) => (
                <Chip
                  key={opt.value}
                  iconAfter={Close}
                  iconAfterAlt="Remove"
                  onIconAfterClick={(e) => {
                    e.stopPropagation();
                    removeSelected(opt);
                  }}
                  disabled={disabled}
                >
                  {opt.label}
                </Chip>
              ))}
              <input
                {...inputCommonProps}
                ref={inputRef}
                onFocus={() => setIsOpen(true)}
                style={{
                  flex: '1 1 0',
                  minWidth: 0,
                  width: 'auto',
                  border: 'none',
                  outline: 'none',
                  padding: '0.25rem 0',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                  backgroundColor: 'transparent',
                }}
              />
            </div>
          </div>
        ) : (
          <Form.Control
            {...inputCommonProps}
            onFocus={() => { if (!value) { setIsOpen(true); } }}
            leadingElement={<Icon src={Search} />}
          />
        )}

        {isOpen && !disabled && (
          <div
            id={`${id}-listbox`}
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 1050,
              border: '1px solid #ced4da',
              borderRadius: '0.375rem',
              backgroundColor: '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              maxHeight: '200px',
              overflowY: 'auto',
              marginTop: '2px',
            }}
          >
            {loading && (
              <div className="d-flex justify-content-center align-items-center p-3">
                <Spinner animation="border" size="sm" />
              </div>
            )}
            {!loading && filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-muted" style={{ fontSize: '0.875rem' }}>
                No results found
              </div>
            )}
            {!loading && filteredOptions.map((option, index) => {
              const isSelected = !isMulti && effectiveValue?.value === option.value;
              return (
                <div
                  key={option.value}
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(option);
                  }}
                  onMouseEnter={() => setFocusedIndex(index)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    backgroundColor: index === focusedIndex ? '#f0f4ff' : 'transparent',
                    color: isSelected ? '#0d6efd' : '#212529',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {option.label}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Form.Group>
  );
};

const optionShape = PropTypes.shape({
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  label: PropTypes.string.isRequired,
});

SearchableSelect.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(optionShape),
  value: PropTypes.oneOfType([
    optionShape,
    PropTypes.arrayOf(optionShape),
  ]),
  multiple: PropTypes.bool,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  required: PropTypes.bool,
};

SearchableSelect.defaultProps = {
  options: [],
  value: null,
  multiple: false,
  placeholder: 'Search...',
  disabled: false,
  loading: false,
  required: false,
};

export default SearchableSelect;
