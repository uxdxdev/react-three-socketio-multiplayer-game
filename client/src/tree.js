import { useCylinder } from '@react-three/cannon';
import { OrangeTree } from './orangeTree';

export const Tree = ({ position: { x, z } }) => {
  const treePhysicsColliderHeight = 6;
  const treePhysicsColliderRadius = 0.3;
  const [treePhysicsRef] = useCylinder(() => ({ args: [treePhysicsColliderRadius, treePhysicsColliderRadius, treePhysicsColliderHeight], type: 'Static', position: [x, treePhysicsColliderHeight / 2, z] }));
  const treeMeshPosition = [0, -treePhysicsColliderHeight / 2, 0];

  return <OrangeTree position={treeMeshPosition} ref={treePhysicsRef} />;
};
