import { useRef, memo } from 'react';

export const Ground = memo(({ width, depth }) => {
  const ref = useRef();

  return (
    <mesh ref={ref} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={0x7cfc00} />
    </mesh>
  );
});
