import React, { forwardRef, memo } from 'react';
import { Fox } from './fox';

export const Player = memo(
  forwardRef(({ moving }, ref) => {
    return <Fox ref={ref} moving={moving} />;
  })
);
