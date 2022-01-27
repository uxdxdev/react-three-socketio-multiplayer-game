import { forwardRef, memo } from 'react';
import { Character } from './character';

export const RemotePlayer = memo(
  forwardRef(({ isMovingRef, position, rotation }, ref) => {
    return <Character ref={ref} isMovingRef={isMovingRef} position={position} rotation={rotation} />;
  })
);
