import { useState } from 'react';

const DEFAULT_VISIBLE_ITEMS = 5;

const useExpandableList = (items, limit = DEFAULT_VISIBLE_ITEMS) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const canExpand = items.length > limit;

  return {
    canExpand,
    isExpanded: canExpand && isExpanded,
    toggleExpanded: () => setIsExpanded(value => !value),
    visibleItems: isExpanded ? items : items.slice(0, limit),
  };
};

export default useExpandableList;
