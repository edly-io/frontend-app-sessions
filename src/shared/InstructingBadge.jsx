import React from 'react';
import { Badge, OverlayTrigger, Tooltip } from '@openedx/paragon';

const TOOLTIP_TEXT = "You're on the instructor roster for this session. You can see the session and its attendance, but mutations remain admin-only.";

const InstructingBadge = () => (
  <OverlayTrigger
    trigger={['hover', 'focus']}
    placement="top"
    overlay={<Tooltip id="instructing-tip">{TOOLTIP_TEXT}</Tooltip>}
  >
    <Badge variant="info">Instructing</Badge>
  </OverlayTrigger>
);

export default InstructingBadge;
