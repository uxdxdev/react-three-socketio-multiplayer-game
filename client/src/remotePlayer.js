import { useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Character } from './character';

export const RemotePlayer = memo(({ position, rotation, moving }) => {
  const ref = useRef();
  // set the remote players initial position
  const initPosition = useRef(position);
  useFrame(() => {
    ref.current.position.x = position[0];
    ref.current.position.z = position[2];
  });

  return <Character ref={ref} moving={moving} position={initPosition.current} rotation={rotation} />;
});
