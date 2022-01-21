const generatePositions = () => {
  const positions = [];
  for (let i = 0; i < 50; i++) {
    const randX = Math.ceil(Math.random() * 50) * (Math.round(Math.random()) ? 1 : -1);
    const randZ = Math.ceil(Math.random() * 50) * (Math.round(Math.random()) ? 1 : -1);
    // const position = { type: 'grassLeaves', bbox: 10, x: randX, z: randZ, rotation: Math.random() * (Math.PI - 0.0) + 0.0 };
    const position = { type: 'mushroom01', x: randX, z: randZ, rotation: Math.random() * (Math.PI - 0.0) + 0.0 };
    positions.push(position);
  }
  console.log(JSON.stringify(positions));
};

generatePositions();
