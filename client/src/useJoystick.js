import nipplejs from 'nipplejs';
import { useEffect, useState } from 'react';
import { useIsMobile } from './useIsMobile';

const initMovement = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};
export const useJoystick = () => {
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
    }
  }, [isMobile]);
  return movement;
};
