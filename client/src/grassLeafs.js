import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useGraph } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';

export const GrassLeafs = ({ position, rotation }) => {
  const { scene, materials } = useGLTF('/grass_leafs.glb');
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone);

  return (
    <group dispose={null}>
      <mesh scale={5} position={[position.x, 0, position.z]} rotation={[0, rotation, 0]} castShadow receiveShadow geometry={nodes.grass_leafs.geometry} material={materials.grass} />
    </group>
  );
};

useGLTF.preload('/grass_leafs.glb');
