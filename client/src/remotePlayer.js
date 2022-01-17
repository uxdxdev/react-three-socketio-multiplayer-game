import { useRef, memo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { Fox } from './fox';

export const RemotePlayer = memo(({ position, rotation, moving }) => {
  const ref = useRef();
  // set the remote players initial position
  const initPosition = useRef(position);
  // when the other players move lerp them to their new positions
  const target = new Vector3(position[0], position[1], position[2]);

  useFrame(() => {
    ref.current.position.lerp(target, 0.2);
  });

  return <Fox ref={ref} moving={moving} position={initPosition.current} rotation={rotation} />;
});
