import { Suspense, useRef, memo, useState, useEffect, useMemo } from 'react';
import { Player } from './player';
import { OrangeTree } from './orangeTree';
import { House } from './house';
import { Loader } from './loader';
import { RemotePlayer } from './remotePlayer';
import { Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Ground } from './ground';
import { CAMERA_Z_DISTANCE_FROM_PLAYER } from './contants';
import { usePlayerControls } from './usePlayerControls';
import { useJoystick } from './useJoystick';
import { useIsMobile } from './useIsMobile';

const updateAngleByRadians = (angle, radians) => {
  return radians - angle;
};

const runCollisionDetection = (playerData, world) => {
  const playerBBoxRotated = getRotatedRectangle(playerData.rotation, playerData.position, world.playerBoundingBox);
  const worldObjects = world.objects;
  for (const worldObject of worldObjects) {
    const objectBBoxRotated = getRotatedRectangle(worldObject.rotation, { x: worldObject.x, z: worldObject.z }, worldObject.bbox);
    if (doPolygonsIntersect(playerBBoxRotated, objectBBoxRotated)) {
      // end the loop and signal a collision
      return true;
    }
  }

  return false;
};

const getRotatedRectangle = (angle, objCenter, bbox) => {
  let bl = rotatePoint(angle, objCenter.x, objCenter.z, objCenter.x + bbox.bl.x, objCenter.z + bbox.bl.z);
  let br = rotatePoint(angle, objCenter.x, objCenter.z, objCenter.x + bbox.br.x, objCenter.z + bbox.br.z);
  let fr = rotatePoint(angle, objCenter.x, objCenter.z, objCenter.x + bbox.fr.x, objCenter.z + bbox.fr.z);
  let fl = rotatePoint(angle, objCenter.x, objCenter.z, objCenter.x + bbox.fl.x, objCenter.z + bbox.fl.z);
  return [bl, br, fr, fl];
};

const rotatePoint = (angle, cx, cz, px, pz) => {
  let x = px;
  let z = pz;
  x -= cx;
  z -= cz;
  let newX = x * Math.cos(angle) - z * Math.sin(angle);
  let newZ = x * Math.sin(angle) + z * Math.cos(angle);
  x = newX + cx;
  z = newZ + cz;
  return {
    x,
    z,
  };
};

const doPolygonsIntersect = (a, b) => {
  var polygons = [a, b];
  var minA, maxA, projected, i, i1, j, minB, maxB;

  for (i = 0; i < polygons.length; i++) {
    // for each polygon, look at each edge of the polygon, and determine if it separates
    // the two shapes
    var polygon = polygons[i];
    for (i1 = 0; i1 < polygon.length; i1++) {
      // grab 2 vertices to create an edge
      var i2 = (i1 + 1) % polygon.length;
      var p1 = polygon[i1];
      var p2 = polygon[i2];

      // find the line perpendicular to this edge
      var normal = { x: p2.z - p1.z, z: p1.x - p2.x };

      minA = maxA = undefined;
      // for each vertex in the first shape, project it onto the line perpendicular to the edge
      // and keep track of the min and max of these values
      for (j = 0; j < a.length; j++) {
        projected = normal.x * a[j].x + normal.z * a[j].z;
        if (isUndefined(minA) || projected < minA) {
          minA = projected;
        }
        if (isUndefined(maxA) || projected > maxA) {
          maxA = projected;
        }
      }

      // for each vertex in the second shape, project it onto the line perpendicular to the edge
      // and keep track of the min and max of these values
      minB = maxB = undefined;
      for (j = 0; j < b.length; j++) {
        projected = normal.x * b[j].x + normal.z * b[j].z;
        if (isUndefined(minB) || projected < minB) {
          minB = projected;
        }
        if (isUndefined(maxB) || projected > maxB) {
          maxB = projected;
        }
      }

      // if there is no overlap between the projects, the edge we are looking at separates the two
      // polygons, and we know there is no overlap
      if (maxA < minB || maxB < minA) {
        return false;
      }
    }
  }
  return true;
};

const isUndefined = (value) => {
  return value === undefined;
};

const sendPlayerData = (socketClient, playerData) => {
  if (socketClient) {
    socketClient.emit('player_update', playerData);
  }
};

const getUpdatedPosition = (position, { forward, backward, left, right }, playerSpeed, delta, world) => {
  const newPosition = { ...position };
  if (left) newPosition.x -= playerSpeed * delta;
  if (right) newPosition.x += playerSpeed * delta;
  if (forward) newPosition.z -= playerSpeed * delta;
  if (backward) newPosition.z += playerSpeed * delta;

  if (newPosition.x < -world.width) newPosition.x = world.width;
  if (newPosition.x > world.width) newPosition.x = -world.width;
  if (newPosition.z < -world.depth) newPosition.z = world.depth;
  if (newPosition.z > world.depth) newPosition.z = -world.depth;

  return newPosition;
};

const getUpdatedPlayerPositionRotation = (currentPosition, currentRotation, controls, playerSpeed, delta, worldData) => {
  let updatedPosition = null;
  let updatedRotation = null;

  // rotation
  const frontVector = new Vector3();
  const sideVector = new Vector3();
  const direction = new Vector3();
  const { forward, backward, left, right } = controls;
  frontVector.set(0, 0, Number(backward) - Number(forward));
  sideVector.set(Number(left) - Number(right), 0, 0);
  direction.subVectors(frontVector, sideVector);
  const newRotation = Math.atan2(direction.z, direction.x);

  // collision detection
  updatedPosition = currentPosition;
  updatedRotation = currentRotation;

  const newPosition = getUpdatedPosition(currentPosition, controls, playerSpeed, delta, worldData);
  const isPlayerColliding = runCollisionDetection({ position: newPosition, rotation: newRotation }, worldData);
  if (!isPlayerColliding) {
    updatedPosition = newPosition;
    updatedRotation = newRotation;
  }
  return { position: updatedPosition, rotation: updatedRotation };
};

export const World = memo(({ userId, socketClient, worldData }) => {
  const playerRef = useRef({ position: { x: 0, z: 0 }, rotation: 0 });
  const serverInProgressMovesRef = useRef([]);
  const playerSavedMovesRef = useRef([]);
  const serverPosition = useRef({ x: 0, z: 0, rotation: 0 });

  const [remotePlayers, setRemotePlayers] = useState([]);

  const isMobile = useIsMobile();
  const keyboard = usePlayerControls();
  const joystick = useJoystick();

  const { forward, backward, left, right } = isMobile ? joystick : keyboard;
  const moving = forward || backward || left || right;
  const PLAYER_SPEED = worldData.playerSpeed;
  const CLIENT_SERVER_POSITION_DIFF_MAX = 10;

  const directionalLightSizeWidth = worldData.width;
  const directionalLightSizeDepth = worldData.depth;
  const directionalLightHeight = worldData.height;
  const shadowCameraDimensionsRight = directionalLightSizeWidth * 2;
  const shadowCameraDimensionsLeft = -directionalLightSizeWidth * 2;
  const shadowCameraDimensionsTop = directionalLightSizeDepth * 2;
  const shadowCameraDimensionsBottom = -directionalLightSizeDepth * 2;
  const shadowResolution = 4096;

  const { trees, houses } = useMemo(() => {
    const trees = worldData.objects.filter((obj) => obj.type === 'tree').map(({ x, z, rotation }, index) => <OrangeTree key={index} position={{ x, z }} rotation={rotation} />);
    const houses = worldData.objects.filter((obj) => obj.type === 'house').map(({ x, z, rotation }, index) => <House key={index} position={{ x, z }} rotation={rotation} />);
    return { trees, houses };
  }, [worldData]);

  useEffect(() => {
    if (socketClient) {
      socketClient.on('players', (allPlayers) => {
        // save server position for move replay in render loop (useFrame)
        serverPosition.current = { x: allPlayers[userId].position.x, z: allPlayers[userId].position.z, rotation: allPlayers[userId].rotation };

        // remove all moves processed by the server leaving only moves being currently process by the server
        serverInProgressMovesRef.current = playerSavedMovesRef.current.filter((savedMove) => {
          return savedMove.ts > allPlayers[userId].ts;
        });

        // remote players
        let players = Object.keys(allPlayers)
          .filter((id) => id !== userId)
          .map((key, index) => {
            const playerData = allPlayers[key];
            const isMoving = playerData.moving;
            const updatedRotation = updateAngleByRadians(playerData.rotation, Math.PI / 2);
            return <RemotePlayer key={index} moving={isMoving} position={[playerData.position.x, playerData.position.y, playerData.position.z]} rotation={updatedRotation} />;
          });

        if (players.length > 0) {
          setRemotePlayers(players);
        }
      });
    }
  }, [socketClient, userId]);

  useFrame(({ camera }, delta) => {
    // CLIENT SIDE PREDICTION REPLAY
    let predictedPlayerPosX = serverPosition.current.x;
    let predictedPlayerPosZ = serverPosition.current.z;
    let predicatedPlayerRotation = serverPosition.current.rotation;

    // replay server moves that are in progress considering collision detection
    serverInProgressMovesRef.current.forEach((unprocessedMove) => {
      const controls = { forward: unprocessedMove.controls.forward, backward: unprocessedMove.controls.backward, left: unprocessedMove.controls.left, right: unprocessedMove.controls.right };
      const { position, rotation } = getUpdatedPlayerPositionRotation(
        {
          x: predictedPlayerPosX,
          z: predictedPlayerPosZ,
        },
        predicatedPlayerRotation,
        controls,
        PLAYER_SPEED,
        delta,
        worldData
      );
      predictedPlayerPosX = position.x;
      predictedPlayerPosZ = position.z;
      predicatedPlayerRotation = rotation;
    });

    if (Math.abs(playerRef.current.position.x - predictedPlayerPosX) > CLIENT_SERVER_POSITION_DIFF_MAX || Math.abs(playerRef.current.position.z - predictedPlayerPosZ) > CLIENT_SERVER_POSITION_DIFF_MAX) {
      // if the players positions is WAY off just reset them to the server position
      // this will happen when a player is leaving the world and re-entering the other side
      playerRef.current.position.x = predictedPlayerPosX;
      playerRef.current.position.z = predictedPlayerPosZ;
    }

    // slowly correct player position to server position
    playerRef.current.position.lerp(new Vector3(predictedPlayerPosX, 0, predictedPlayerPosZ), 0.1);

    // set player rotation to server rotation
    const updatedModelRotation = updateAngleByRadians(predicatedPlayerRotation, Math.PI / 2);
    playerRef.current.rotation.set(0, updatedModelRotation, 0);

    if (moving) {
      // SEND PLAYER INPUTS TO SERVER
      const playerData = {
        id: userId,
        controls: {
          forward,
          backward,
          left,
          right,
        },
        ts: Date.now(),
      };
      sendPlayerData(socketClient, playerData);

      // CLIENT SIDE PREDICTION
      const { position, rotation } = getUpdatedPlayerPositionRotation(
        {
          x: playerRef.current.position.x,
          z: playerRef.current.position.z,
        },
        updateAngleByRadians(playerRef.current.rotation.y, Math.PI / 2),
        { forward, backward, left, right },
        PLAYER_SPEED,
        delta,
        worldData
      );
      playerRef.current.position.x = position.x;
      playerRef.current.position.z = position.z;

      const updatedModelRotation = updateAngleByRadians(rotation, Math.PI / 2);
      playerRef.current.rotation.set(0, updatedModelRotation, 0);

      playerSavedMovesRef.current.push(playerData);

      while (playerSavedMovesRef.current.length > 30) {
        playerSavedMovesRef.current.shift();
      }
    }

    // get the camera to follow the player by updating x and z coordinates
    camera.position.setX(playerRef.current.position.x);
    camera.position.setZ(playerRef.current.position.z + CAMERA_Z_DISTANCE_FROM_PLAYER);
  });

  return (
    <>
      <ambientLight />
      <directionalLight
        castShadow
        position={[directionalLightSizeWidth, directionalLightHeight, directionalLightSizeDepth]}
        shadow-camera-right={shadowCameraDimensionsRight}
        shadow-camera-left={shadowCameraDimensionsLeft}
        shadow-camera-top={shadowCameraDimensionsTop}
        shadow-camera-bottom={shadowCameraDimensionsBottom}
        shadow-mapSize-width={shadowResolution}
        shadow-mapSize-height={shadowResolution}
      />
      <Suspense fallback={<Loader />}>
        <Player ref={playerRef} moving={moving} />
        {remotePlayers}
        {trees}
        {houses}
        <Ground width={worldData.width * 3} depth={worldData.depth * 3} />
      </Suspense>
    </>
  );
});
