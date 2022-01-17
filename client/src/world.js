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

const sendPlayerData = ({ socketClient, userId, controls: { forward, backward, left, right } }) => {
  if (socketClient) {
    const playerData = { id: userId, controls: { forward, backward, left, right } };
    socketClient.emit('player_update', playerData);
  }
};

export const World = memo(({ userId, socketClient, worldData }) => {
  const playerRef = useRef();
  const playerServerPositionRef = useRef();
  const last = useRef(0);
  const [remotePlayers, setRemotePlayers] = useState([]);
  const isMobile = useIsMobile();
  const keyboard = usePlayerControls();
  const joystick = useJoystick();
  const { forward, backward, left, right } = isMobile ? joystick : keyboard;

  const moving = forward || backward || left || right;
  let now = 0;

  // lag compensation uses ideal speed for corrections
  const PLAYER_IDEAL_SPEED = 0.23;
  const PLAYER_SPEED = useRef(PLAYER_IDEAL_SPEED);

  const prevTime = useRef(0.0);
  const prevDelta = useRef(0.0);

  const CLIENT_SERVER_POSITION_DIFF_MIN = 2;
  const CLIENT_SERVER_POSITION_DIFF_MAX = 10;
  let millisecondsPerTick = 33; // client tick rate for sending data to server
  let tickRate = millisecondsPerTick / 1000;
  const frontVector = new Vector3();
  const sideVector = new Vector3();
  const direction = new Vector3();

  const { trees, houses } = useMemo(() => {
    const trees = worldData.objects.filter((obj) => obj.type === 'tree').map(({ x, z, rotation }, index) => <OrangeTree key={index} position={{ x, z }} rotation={rotation} />);
    const houses = worldData.objects.filter((obj) => obj.type === 'house').map(({ x, z, rotation }, index) => <House key={index} position={{ x, z }} rotation={rotation} />);
    return { trees, houses };
  }, [worldData]);

  useEffect(() => {
    if (socketClient) {
      socketClient.on('players', (allPlayers) => {
        // client ping
        const ping = Date.now() - allPlayers[userId].timestamp;
        document.getElementById('ping').innerText = ping;

        // main player
        const serverPositionX = allPlayers[userId].position.x;
        const serverPositionZ = allPlayers[userId].position.z;

        // save the players server side position for interpolation in the render loop
        playerServerPositionRef.current = { x: serverPositionX, z: serverPositionZ };

        // when the players client side position differs from the server side position
        // make some adjustments
        if (Math.abs(playerRef.current.position.x - serverPositionX) > CLIENT_SERVER_POSITION_DIFF_MIN || Math.abs(playerRef.current.position.z - serverPositionZ) > CLIENT_SERVER_POSITION_DIFF_MIN) {
          // update player speed to try and reduce the difference of player position
          // between server and client
          const now = Date.now();
          const delta = now - prevTime.current;
          if (delta > prevDelta.current) {
            // if corrections occur more often it's likely ping has increased so reduce player speed
            PLAYER_SPEED.current -= 0.005;
          } else {
            // else ping has decreased so increase player speed
            PLAYER_SPEED.current += 0.005;
          }

          // if player speed differs from ideal speed too much correct player speed
          if (Math.abs(PLAYER_SPEED.current - PLAYER_IDEAL_SPEED) > 0.05) {
            PLAYER_SPEED.current = PLAYER_IDEAL_SPEED;
          }

          prevTime.current = now;
          prevDelta.current = delta;

          // correct player position for world boundary loop
          if (Math.abs(playerRef.current.position.x - serverPositionX) > CLIENT_SERVER_POSITION_DIFF_MAX || Math.abs(playerRef.current.position.z - serverPositionZ) > CLIENT_SERVER_POSITION_DIFF_MAX) {
            // if the players positions is WAY off just reset them to the server position
            // this will happen when a player is leaving the world and re-entering the other side
            playerRef.current.position.x = serverPositionX;
            playerRef.current.position.z = serverPositionZ;
          }
        }

        // if a GLB model is not facing the X positive axis (to the right) we need to rotate it
        // so that our collision detection from the server works because it's based on a direction
        // value in radians of 0 pointing parallel to the positive X axis, see Math.atan2()
        // player fox model currently facing Z positive, which means it needs to be updated to face X positive
        const modelRotation = updateAngleByRadians(allPlayers[userId].rotation, Math.PI / 2);
        if (Math.abs(playerRef.current.rotation.y - modelRotation) > 1) {
          playerRef.current.rotation.set(0, modelRotation, 0);
        }

        // remote players
        let players = Object.keys(allPlayers)
          .filter((id) => id !== userId)
          .map((key, index) => {
            const playerData = allPlayers[key];
            const isMoving = playerData.controls.left || playerData.controls.right || playerData.controls.forward || playerData.controls.backward;
            const updatedRotation = updateAngleByRadians(playerData.rotation, Math.PI / 2);
            return <RemotePlayer key={index} moving={isMoving} position={[playerData.position.x, playerData.position.y, playerData.position.z]} rotation={updatedRotation} />;
          });

        if (players.length > 0) {
          setRemotePlayers(players);
        }
      });
    }
  }, [socketClient, userId]);

  useFrame(({ camera, clock }) => {
    frontVector.set(0, 0, Number(backward) - Number(forward));
    sideVector.set(Number(left) - Number(right), 0, 0);
    direction.subVectors(frontVector, sideVector);
    const rotation = Math.atan2(direction.z, direction.x);

    if (playerRef.current) {
      // client side collision detection
      const isPlayerColliding = runCollisionDetection({ position: playerRef.current.position, rotation }, worldData);
      if (!isPlayerColliding) {
        if (left) playerRef.current.position.x -= PLAYER_SPEED.current;
        if (right) playerRef.current.position.x += PLAYER_SPEED.current;
        if (forward) playerRef.current.position.z -= PLAYER_SPEED.current;
        if (backward) playerRef.current.position.z += PLAYER_SPEED.current;
      }

      // if player leaves world boundaries position them on the other side of the world
      // this gives the illusion that the player is running around on a sphere
      if (playerRef.current.position.x < -worldData.width) playerRef.current.position.x = worldData.width;
      if (playerRef.current.position.x > worldData.width) playerRef.current.position.x = -worldData.width;
      if (playerRef.current.position.z < -worldData.depth) playerRef.current.position.z = worldData.depth;
      if (playerRef.current.position.z > worldData.depth) playerRef.current.position.z = -worldData.depth;

      const modelRotation = updateAngleByRadians(rotation, Math.PI / 2);
      // only update the players rotation if moving, this preserves the rotation the player was in before releasing all keys
      moving && playerRef.current.rotation.set(0, modelRotation, 0);

      // continuously correct the players position to align with the server side position data
      if (playerServerPositionRef.current) {
        playerRef.current.position.lerp(new Vector3(playerServerPositionRef.current.x, 0, playerServerPositionRef.current.z), 0.05);
      }

      // get the camera to follow the player by updating x and z coordinates
      camera.position.setX(playerRef.current.position.x);
      camera.position.setZ(playerRef.current.position.z + CAMERA_Z_DISTANCE_FROM_PLAYER);
    }
    // run this block at tickRate
    now = clock.getElapsedTime();
    if (now - last.current >= tickRate) {
      // send player position to server
      sendPlayerData({
        socketClient,
        userId,
        controls: {
          forward,
          backward,
          left,
          right,
        },
      });
      // reset the elapsed time if it goes over our tickrate
      last.current = now;
    }
  });

  const directionalLightSizeWidth = worldData.width;
  const directionalLightSizeDepth = worldData.depth;
  const directionalLightHeight = worldData.height;
  const shadowCameraDimensionsRight = directionalLightSizeWidth * 2;
  const shadowCameraDimensionsLeft = -directionalLightSizeWidth * 2;
  const shadowCameraDimensionsTop = directionalLightSizeDepth * 2;
  const shadowCameraDimensionsBottom = -directionalLightSizeDepth * 2;
  const shadowResolution = 4096;

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
