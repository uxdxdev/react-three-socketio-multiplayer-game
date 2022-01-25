import { useState, useEffect } from 'react';
import { useIsMobile } from './useIsMobile';
import nipplejs from 'nipplejs';

const keys = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'left',
  KeyD: 'right',
};
const moveFieldByKey = (key) => keys[key];

const initMovement = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

export const usePlayerControls = () => {
  const [movement, setMovement] = useState(initMovement);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      const manager = nipplejs.create({
        zone: document.getElementById('joystick'),
        dynamicPage: true,
        position: { bottom: '100px', left: '100px' },
        mode: 'static',
      });

      manager.on('move', function (evt, data) {
        const direction = Math.round(data.angle.degree / 45.0) * 45.0;
        if (direction === 0 || direction === 360) setMovement({ ...initMovement, right: true });
        if (direction === 45) setMovement({ ...initMovement, forward: true, right: true });
        if (direction === 90) setMovement({ ...initMovement, forward: true });
        if (direction === 135) setMovement({ ...initMovement, forward: true, left: true });
        if (direction === 180) setMovement({ ...initMovement, left: true });
        if (direction === 225) setMovement({ ...initMovement, left: true, backward: true });
        if (direction === 270) setMovement({ ...initMovement, backward: true });
        if (direction === 315) setMovement({ ...initMovement, backward: true, right: true });
      });

      manager.on('end', function (evt) {
        setMovement({
          forward: false,
          backward: false,
          left: false,
          right: false,
        });
      });
    } else {
      const handleKeyDown = (e) => setMovement((m) => ({ ...m, [moveFieldByKey(e.code)]: true }));
      const handleKeyUp = (e) => setMovement((m) => ({ ...m, [moveFieldByKey(e.code)]: false }));
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('keyup', handleKeyUp);
      };
    }
  }, [isMobile]);

  return movement;
};
