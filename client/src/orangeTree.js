import React, { useMemo, memo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useGraph } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';

export const OrangeTree = memo(({ position, rotation }) => {
  const { scene, materials } = useGLTF('/Orange tree.glb');
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone);

  return (
    <group dispose={null}>
      <mesh position={[position.x, 0, position.z]} rotation={[0, rotation, 0]} castShadow receiveShadow geometry={nodes.OrangeTree.geometry} material={materials.OrangeTree_mat} />
    </group>
  );
});

useGLTF.preload('/Orange tree.glb');
