import { Suspense, useRef, memo, useState, useEffect, createRef } from 'react';
import { Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Player } from './player';
import { Loader } from './loader';
import { RemotePlayer } from './remotePlayer';
import { Ground } from './ground';
import { CAMERA_Z_DISTANCE_FROM_PLAYER } from './contants';
import { Environment } from './environment';
import { Bee } from './bee';
import { getUpdatedPlayerPositionRotation } from '@uxdx/multiplayer-engine';

const CLIENT_SERVER_POSITION_DIFF_MAX = 10;

const updateAngleByRadians = (angle, radians) => {
  return radians - angle;
};

export const World = memo(({ userId, socketClient, worldData }) => {
  const playerRef = useRef({ position: { x: 0, z: 0 }, rotation: 0 });
  const serverInProgressMovesRef = useRef([]);
  const playerSavedMovesRef = useRef([]);
  const serverPosition = useRef({ x: 0, z: 0, rotation: 0 });
  const remotePlayersRef = useRef({});
  const isPlayerMovingRef = useRef(false);
  const allPlayersRef = useRef({});

  const [remotePlayers, setRemotePlayers] = useState([]);

  const PLAYER_SPEED = worldData.playerSpeed;

  useEffect(() => {
    if (socketClient) {
      socketClient.on('world_update', (allPlayers) => {
        // save server position for move replay in render loop (useFrame)
        if (allPlayers[userId]) {
          serverPosition.current = { x: allPlayers[userId].position.x, z: allPlayers[userId].position.z, rotation: allPlayers[userId].rotation };

          // remove all moves processed by the server leaving only moves being currently process by the server
          serverInProgressMovesRef.current = playerSavedMovesRef.current.filter((savedMove) => {
            return savedMove.ts > allPlayers[userId].ts;
          });
        }

        // delete this user from the world update
        delete allPlayers[userId];

        allPlayersRef.current = allPlayers;

        // rebuild the component tree if there is any difference
        // between client and server players
        const serverPlayerKeys = Object.keys(allPlayers).sort();
        const clientPlayerKeys = Object.keys(remotePlayersRef.current).sort();
        if (serverPlayerKeys.toString() !== clientPlayerKeys.toString()) {
          remotePlayersRef.current = {};
          const updatedRemotePlayers = [];
          serverPlayerKeys.forEach((key) => {
            const ref = createRef();
            const isMovingRef = createRef();
            const playerData = allPlayers[key];
            const updatedRotation = updateAngleByRadians(playerData.rotation, Math.PI / 2);
            const remotePlayer = <RemotePlayer ref={ref} key={key} position={[playerData.position.x, 0, playerData.position.z]} rotation={updatedRotation} isMovingRef={isMovingRef} />;

            updatedRemotePlayers.push(remotePlayer);
            remotePlayersRef.current[key] = {
              ref,
              isMovingRef,
            };
          });
          setRemotePlayers(updatedRemotePlayers);
        }
      });
    }
  }, [socketClient, userId]);

  useFrame(({ camera }, delta) => {
    Object.keys(allPlayersRef.current).forEach((serverPlayerKey) => {
      // if the player exists on the client already just update their position
      if (remotePlayersRef.current.hasOwnProperty(serverPlayerKey)) {
        const playerData = allPlayersRef.current[serverPlayerKey];
        const updatedRotation = updateAngleByRadians(playerData.rotation, Math.PI / 2);
        if (remotePlayersRef.current[serverPlayerKey].ref.current) {
          remotePlayersRef.current[serverPlayerKey].ref.current.position.lerp(new Vector3(allPlayersRef.current[serverPlayerKey].position.x, 0, allPlayersRef.current[serverPlayerKey].position.z), 0.2);

          // when the player lerps close enough to server position lock it in
          if (Math.abs(remotePlayersRef.current[serverPlayerKey].ref.current.position.x - allPlayersRef.current[serverPlayerKey].position.x) < 0.1) {
            remotePlayersRef.current[serverPlayerKey].ref.current.position.x = allPlayersRef.current[serverPlayerKey].position.x;
          }
          if (Math.abs(remotePlayersRef.current[serverPlayerKey].ref.current.position.z - allPlayersRef.current[serverPlayerKey].position.z) < 0.1) {
            remotePlayersRef.current[serverPlayerKey].ref.current.position.z = allPlayersRef.current[serverPlayerKey].position.z;
          }

          remotePlayersRef.current[serverPlayerKey].ref.current.rotation.set(0, updatedRotation, 0);

          //  check if player is moving
          if (
            remotePlayersRef.current[serverPlayerKey].ref.current.position.x !== allPlayersRef.current[serverPlayerKey].position.x ||
            remotePlayersRef.current[serverPlayerKey].ref.current.position.z !== allPlayersRef.current[serverPlayerKey].position.z
          ) {
            remotePlayersRef.current[serverPlayerKey].isMovingRef.current = true;
          } else {
            remotePlayersRef.current[serverPlayerKey].isMovingRef.current = false;
          }
        }
      }
    });

    // CLIENT SIDE PREDICTION REPLAY
    let correctedPlayerPositionX = serverPosition.current.x;
    let correctedPlayerPositionZ = serverPosition.current.z;
    let predicatedPlayerRotation = serverPosition.current.rotation;

    // replay server moves that are in progress considering collision detection
    serverInProgressMovesRef.current.forEach((unprocessedMove) => {
      const controls = { forward: unprocessedMove.controls.forward, backward: unprocessedMove.controls.backward, left: unprocessedMove.controls.left, right: unprocessedMove.controls.right };
      const { position, rotation } = getUpdatedPlayerPositionRotation(
        {
          x: correctedPlayerPositionX,
          z: correctedPlayerPositionZ,
        },
        predicatedPlayerRotation,
        controls,
        PLAYER_SPEED,
        delta,
        worldData,
        worldData.playerBoundingBox
      );
      correctedPlayerPositionX = position.x;
      correctedPlayerPositionZ = position.z;
      predicatedPlayerRotation = rotation;
    });

    if (Math.abs(playerRef.current.position.x - correctedPlayerPositionX) > CLIENT_SERVER_POSITION_DIFF_MAX || Math.abs(playerRef.current.position.z - correctedPlayerPositionZ) > CLIENT_SERVER_POSITION_DIFF_MAX) {
      // if the players position is WAY off just reset them to the server position
      // this will happen when a player is leaving the world and re-entering the other side
      playerRef.current.position.x = correctedPlayerPositionX;
      playerRef.current.position.z = correctedPlayerPositionZ;
    }

    // slowly correct players predicted position to server position
    isPlayerMovingRef.current && playerRef.current.position.lerp(new Vector3(correctedPlayerPositionX, 0, correctedPlayerPositionZ), 0.2);

    // when the player lerps close enough to server position lock it in
    if (Math.abs(playerRef.current.position.x - correctedPlayerPositionX) < 0.1) {
      playerRef.current.position.x = correctedPlayerPositionX;
    }
    if (Math.abs(playerRef.current.position.z - correctedPlayerPositionZ) < 0.1) {
      playerRef.current.position.z = correctedPlayerPositionZ;
    }

    // set player rotation to server rotation
    const updatedModelRotation = updateAngleByRadians(predicatedPlayerRotation, Math.PI / 2);
    playerRef.current.rotation.set(0, updatedModelRotation, 0);

    // get the camera to follow the player by updating x and z coordinates
    camera.position.setX(playerRef.current.position.x);
    camera.position.setZ(playerRef.current.position.z + CAMERA_Z_DISTANCE_FROM_PLAYER);
  });

  return (
    <Suspense fallback={<Loader />}>
      <Player ref={playerRef} isMovingRef={isPlayerMovingRef} userId={userId} socketClient={socketClient} playerSavedMovesRef={playerSavedMovesRef} playerSpeed={PLAYER_SPEED} worldData={worldData} />
      {remotePlayers}
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />
      <Bee position={[0, 20, 0]} />

      <Environment worldData={worldData} />
      <Ground width={worldData.width * 3} depth={worldData.depth * 3} />
    </Suspense>
  );
});
