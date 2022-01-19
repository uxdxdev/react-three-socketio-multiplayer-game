const pick = ['left', 'right', 'forward', 'backward'];
const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateRandomPlayers = () => {
  // randomly move the players around
  for (let p = 0; p < 100; p++) {
    players['player' + p].controls = {
      left: false,
      right: false,
      forward: false,
      backward: false,
    };
    const index = getRandomInt(0, 3);
    const direction = pick[index];
    players['player' + p].controls[direction] = true;
  }
};

export const initRandomPlayers = () => {
  // setup some players
  for (let p = 0; p < 100; p++) {
    players['player' + p] = {
      position: {
        x: 0,
        y: 0,
        z: 0,
      },
      rotation: 0,
      controls: {
        left: false,
        right: false,
        forward: false,
        backward: false,
      },
    };
  }
};
