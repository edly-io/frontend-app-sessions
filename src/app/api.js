// TODO(phase-6B): swap this stub for a real GET /fbr/api/programs/v1/programs/
// call once the programs team ships the endpoint. Shape of each item must
// stay `{ id, slug, name }` so callers don't change.
const STUB_PROGRAMS = [
  { id: 1, slug: 'default', name: 'Default Program' },
  { id: 2, slug: 'second', name: 'Second Program' },
];

// eslint-disable-next-line import/prefer-default-export
export const getPrograms = async () => STUB_PROGRAMS;
