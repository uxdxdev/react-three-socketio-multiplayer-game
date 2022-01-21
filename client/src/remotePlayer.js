import { memo, useRef } from 'react';
import { Character } from './character';

export const RemotePlayer = memo((props) => {
  return <Character ref={useRef()} {...props} />;
});
