import { useMediaQuery } from '@openedx/paragon';

export default function useIsBelowLg() {
  return !useMediaQuery({ minWidth: 992 });
}
