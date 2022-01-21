import React, { forwardRef, memo } from 'react';
import { Character } from './character';

export const Player = memo(
  forwardRef(({ moving }, ref) => {
    return <Character ref={ref} moving={moving} />;
  })
);
