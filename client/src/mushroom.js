import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { useGraph } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';

export const Mushroom = ({ position, rotation }) => {
  const { scene, materials } = useGLTF('/mushroom_redGroup.glb');
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone);

  return (
    <group dispose={null} position={[position.x, 0, position.z]} rotation={[0, rotation, 0]} scale={5}>
      <mesh castShadow receiveShadow geometry={nodes.Mesh_mushroom_redGroup.geometry} material={materials._defaultMat} />
      <mesh castShadow receiveShadow geometry={nodes.Mesh_mushroom_redGroup_1.geometry} material={materials.colorRed} />
    </group>
  );
};

useGLTF.preload('/mushroom_redGroup.glb');
