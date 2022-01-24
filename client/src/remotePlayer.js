import { forwardRef, memo } from 'react';
import { Character } from './character';

export const RemotePlayer = memo(
  forwardRef((props, ref) => {
    return <Character ref={ref} {...props} />;
  })
);
