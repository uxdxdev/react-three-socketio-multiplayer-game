import React, { forwardRef, memo } from 'react';
import { Character } from './character';

export const Player = memo(
  forwardRef((_, ref) => {
    return <Character ref={ref} />;
  })
);
