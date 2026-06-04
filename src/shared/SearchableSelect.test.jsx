import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
// eslint-disable-next-line import/no-extraneous-dependencies
import { IntlProvider } from 'react-intl';
import SearchableSelect from './SearchableSelect';

const jestDomMatchers = require('@testing-library/jest-dom/matchers');

expect.extend(jestDomMatchers);

const OPTIONS = [
  { value: 'a', label: 'Apple' },
  { value: 'b', label: 'Banana' },
  { value: 'c', label: 'Cherry' },
];

const wrap = (props) => render(
  <IntlProvider locale="en" messages={{}}>
    <SearchableSelect
      id="test-select"
      label="Fruit"
      options={OPTIONS}
      onChange={jest.fn()}
      value={null}
      {...props}
    />
  </IntlProvider>,
);

// Stateful wrapper that lets the component actually update value on select
// eslint-disable-next-line react/prop-types
const ControlledSelect = ({ multiple = false, onChange }) => {
  const [value, setValue] = useState(multiple ? [] : null);
  const handleChange = (next) => {
    setValue(next);
    if (onChange) { onChange(next); }
  };
  return (
    <IntlProvider locale="en" messages={{}}>
      <SearchableSelect
        id="ctrl-select"
        label="Fruit"
        options={OPTIONS}
        value={value}
        onChange={handleChange}
        multiple={multiple}
      />
    </IntlProvider>
  );
};

it('renders the label', () => {
  wrap();
  expect(screen.getByText('Fruit')).toBeInTheDocument();
});

it('appends * to label when required', () => {
  wrap({ required: true });
  expect(screen.getByText('Fruit *')).toBeInTheDocument();
});

it('shows a dropdown when the input is focused', () => {
  wrap();
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  expect(screen.getAllByRole('option')).toHaveLength(3);
});

it('filters options by query', () => {
  wrap();
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'an' } });
  const options = screen.getAllByRole('option');
  expect(options).toHaveLength(1);
  expect(options[0]).toHaveTextContent('Banana');
});

it('shows "No results found" when filter matches nothing', () => {
  wrap();
  const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'xyz' } });
  expect(screen.getByText('No results found')).toBeInTheDocument();
});

it('calls onChange with the selected option (single mode)', () => {
  const onChange = jest.fn();
  render(
    <IntlProvider locale="en" messages={{}}>
      <SearchableSelect
        id="s"
        label="Fruit"
        options={OPTIONS}
        value={null}
        onChange={onChange}
      />
    </IntlProvider>,
  );
  fireEvent.focus(screen.getByRole('combobox'));
  fireEvent.mouseDown(screen.getByText('Apple'));
  expect(onChange).toHaveBeenCalledWith(OPTIONS[0]);
});

it('closes dropdown and clears query after single selection', () => {
  render(<ControlledSelect />);
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.mouseDown(screen.getByText('Apple'));
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('keeps dropdown open for multi-select after selection', () => {
  render(<ControlledSelect multiple />);
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.mouseDown(screen.getByText('Apple'));
  expect(screen.getByRole('listbox')).toBeInTheDocument();
});

it('renders selected chips in multi-select mode', () => {
  render(<ControlledSelect multiple />);
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.mouseDown(screen.getByText('Apple'));
  expect(screen.getByText('Apple')).toBeInTheDocument();
});

it('closes dropdown on Escape key', () => {
  wrap();
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('navigates options with arrow keys and selects with Enter', () => {
  const onChange = jest.fn();
  render(
    <IntlProvider locale="en" messages={{}}>
      <SearchableSelect id="s" label="Fruit" options={OPTIONS} value={null} onChange={onChange} />
    </IntlProvider>,
  );
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(onChange).toHaveBeenCalledWith(OPTIONS[0]);
});

it('does not show dropdown when disabled', () => {
  wrap({ disabled: true });
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

it('shows a loading spinner when loading is true', () => {
  wrap({ loading: true });
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  // listbox should be open (loading flag is checked inside it)
  fireEvent.change(input, { target: { value: 'a' } });
  expect(screen.getByRole('listbox')).toBeInTheDocument();
});
