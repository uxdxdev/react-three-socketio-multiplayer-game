import React, { useMemo, memo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useGraph } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';

export const House = memo(({ position, rotation }) => {
  const { scene, materials } = useGLTF('/House.glb');
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone);

  return (
    <group dispose={null}>
      <mesh scale={[10, 10, 10]} position={[position.x, 6, position.z]} rotation={[0, rotation, 0]} castShadow receiveShadow geometry={nodes.house.geometry} material={materials.None} />
    </group>
  );
});

useGLTF.preload('/House.glb');
