import React, { forwardRef, memo } from 'react';
import { Character } from './character';
import { usePlayerControls } from './usePlayerControls';
import { useFrame } from '@react-three/fiber';
import { getUpdatedPlayerPositionRotation } from '@uxdx/multiplayer-engine';

const updateAngleByRadians = (angle, radians) => {
  return radians - angle;
};

const sendPlayerData = (socketClient, playerData) => {
  if (socketClient) {
    socketClient.emit('player_update', playerData);
  }
};

export const Player = memo(
  forwardRef(({ userId, socketClient, playerSavedMovesRef, playerSpeed, worldData, isMovingRef }, ref) => {
    const controls = usePlayerControls();
    const { forward, backward, left, right } = controls;
    const moving = forward || backward || left || right;

    useFrame((_, delta) => {
      isMovingRef.current = moving;
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
            x: ref.current.position.x,
            z: ref.current.position.z,
          },
          updateAngleByRadians(ref.current.rotation.y, Math.PI / 2),
          { forward, backward, left, right },
          playerSpeed,
          delta,
          worldData,
          worldData.playerBoundingBox
        );
        ref.current.position.x = position.x;
        ref.current.position.z = position.z;

        const updatedModelRotation = updateAngleByRadians(rotation, Math.PI / 2);
        ref.current.rotation.set(0, updatedModelRotation, 0);

        playerSavedMovesRef.current.push(playerData);

        while (playerSavedMovesRef.current.length > 30) {
          playerSavedMovesRef.current.shift();
        }
      }
    });

    return <Character ref={ref} isMovingRef={isMovingRef} />;
  })
);
