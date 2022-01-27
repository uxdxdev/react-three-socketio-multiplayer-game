import React, { forwardRef, useMemo, memo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame, useGraph } from '@react-three/fiber';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils';

export const Character = memo(
  forwardRef((props, ref) => {
    const { scene, materials, animations } = useGLTF('/Character.gltf');
    const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
    const { nodes } = useGraph(clone);
    const { rotation, position, isMovingRef } = props;
    const { actions } = useAnimations(animations, ref);

    useFrame(() => {
      if (isMovingRef.current) {
        actions.Idle.stop();
        actions.Run.play();
      } else {
        actions.Run.stop();
        actions.Idle.play();
      }
    });

    return (
      <group ref={ref} position={position} rotation={[0, rotation, 0]} dispose={null} scale={[1, 1, 1]}>
        <primitive object={nodes.Root} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve000.geometry} material={nodes.CUBezierCurve000.material} skeleton={nodes.CUBezierCurve000.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve000_1.geometry} material={nodes.CUBezierCurve000_1.material} skeleton={nodes.CUBezierCurve000_1.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve002.geometry} material={nodes.CUBezierCurve002.material} skeleton={nodes.CUBezierCurve002.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve002_1.geometry} material={nodes.CUBezierCurve002_1.material} skeleton={nodes.CUBezierCurve002_1.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve002_2.geometry} material={materials.Main2} skeleton={nodes.CUBezierCurve002_2.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.Ears.geometry} material={nodes.Ears.material} skeleton={nodes.Ears.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve003.geometry} material={nodes.CUBezierCurve003.material} skeleton={nodes.CUBezierCurve003.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve003_1.geometry} material={materials.Black} skeleton={nodes.CUBezierCurve003_1.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve003_2.geometry} material={nodes.CUBezierCurve003_2.material} skeleton={nodes.CUBezierCurve003_2.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve003_3.geometry} material={materials.White} skeleton={nodes.CUBezierCurve003_3.skeleton} />
        <skinnedMesh castShadow receiveShadow geometry={nodes.CUBezierCurve003_4.geometry} material={materials.EyeColor} skeleton={nodes.CUBezierCurve003_4.skeleton} />
      </group>
    );
  })
);

useGLTF.preload('/Character.gltf');
