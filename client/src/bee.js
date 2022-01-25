import React, { useRef, useEffect, memo, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Vector3 } from 'three';
import { useGraph, useFrame } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';
import { getRandomInt } from '@uxdx/multiplayer-engine';

const getRandomPosition = () => {
  const randX = Math.ceil(Math.random() * 50) * (Math.round(Math.random()) ? 1 : -1);
  const randY = getRandomInt(2, 20);
  const randZ = Math.ceil(Math.random() * 50) * (Math.round(Math.random()) ? 1 : -1);
  return { x: randX, y: randY, z: randZ };
};

const updateAngleByRadians = (angle, radians) => {
  return radians - angle;
};

const getUpdatedRotation = (playerPositionV3, targetV3) => {
  const direction = new Vector3(0, 0, 0);
  direction.subVectors(targetV3, playerPositionV3);
  let rotation = Math.atan2(direction.z, direction.x);
  return updateAngleByRadians(rotation, Math.PI / 2);
};

export const Bee = memo(({ position }) => {
  const ref = useRef();
  const target = useRef(new Vector3(0, position[1], 0));
  const { scene, materials, animations } = useGLTF('/Bee.gltf');
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone);

  const { actions } = useAnimations(animations, ref);
  const BEE_SPEED = 5;

  useEffect(() => {
    actions?.Flying.play();
    setTimeout(() => {
      actions?.Bite_Front.play();
    }, getRandomInt(1, 3000));
  }, [actions]);

  useFrame((_, delta) => {
    if (ref.current.position.distanceTo(target.current) > 0.1) {
      ref.current.position.lerp(target.current, (BEE_SPEED * delta) / ref.current.position.distanceTo(target.current));
    } else {
      const newTarget = getRandomPosition();
      target.current.set(newTarget.x, newTarget.y, newTarget.z);
      ref.current.rotation.set(0, getUpdatedRotation(ref.current.position, target.current), 0);
    }
  });

  return (
    <group ref={ref} position={position} dispose={null}>
      <primitive object={nodes.Body} />
      <primitive object={nodes.Head} />
      <skinnedMesh castShadow receiveShadow geometry={nodes.Cube001.geometry} material={materials.Main} skeleton={nodes.Cube001.skeleton} />
      <skinnedMesh castShadow receiveShadow geometry={nodes.Cube001_1.geometry} material={materials.Main_2} skeleton={nodes.Cube001_1.skeleton} />
      <skinnedMesh castShadow receiveShadow geometry={nodes.Cube001_2.geometry} material={materials.Wings} skeleton={nodes.Cube001_2.skeleton} />
      <skinnedMesh castShadow receiveShadow geometry={nodes.Cube001_3.geometry} material={materials.Teeth} skeleton={nodes.Cube001_3.skeleton} />
      <skinnedMesh castShadow receiveShadow geometry={nodes.Cube001_4.geometry} material={materials.Tongue} skeleton={nodes.Cube001_4.skeleton} />
      <skinnedMesh castShadow receiveShadow geometry={nodes.Cube001_5.geometry} material={materials.Eyes} skeleton={nodes.Cube001_5.skeleton} />
    </group>
  );
});

useGLTF.preload('/Bee.gltf');
