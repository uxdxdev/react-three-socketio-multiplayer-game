import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useGraph } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';

export const PlantBushDetailed = ({ position, rotation }) => {
  const { scene, materials } = useGLTF('/plant_bushDetailed.glb');
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone);

  return (
    <group dispose={null}>
      <mesh scale={5} position={[position.x, 0, position.z]} rotation={[0, rotation, 0]} castShadow receiveShadow geometry={nodes.plant_bushDetailed.geometry} material={materials.grass} />
    </group>
  );
};

useGLTF.preload('/plant_bushDetailed.glb');
