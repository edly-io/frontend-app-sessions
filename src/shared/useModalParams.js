import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

const useModalParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const modal = searchParams.get('modal');
  const modalId = searchParams.get('id');

  const openModal = useCallback((name, id = null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('modal', name);
      if (id !== null) { next.set('id', String(id)); } else { next.delete('id'); }
      return next;
    });
  }, [setSearchParams]);

  const closeModal = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('modal');
      next.delete('id');
      return next;
    });
  }, [setSearchParams]);

  return {
    modal, modalId, openModal, closeModal,
  };
};

export default useModalParams;
