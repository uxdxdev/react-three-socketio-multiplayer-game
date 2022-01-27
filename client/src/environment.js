import { useMemo, memo } from 'react';
import { OrangeTree } from './orangeTree';
import { House } from './house';
import { GrassLeafs } from './grassLeafs';
import { PlantBushDetailed } from './plantBushDetailed';
import { Mushroom } from './mushroom';

export const Environment = memo(({ worldData }) => {
  const environment = useMemo(() => {
    const trees = worldData.collidableObjects.filter((obj) => obj.type === 'tree01').map(({ x, z, rotation }, index) => <OrangeTree key={index} position={{ x, z }} rotation={rotation} />);
    const houses = worldData.collidableObjects.filter((obj) => obj.type === 'house01').map(({ x, z, rotation }, index) => <House key={index} position={{ x, z }} rotation={rotation} />);
    const grassLeafs = worldData.noncollidableObjects.filter((obj) => obj.type === 'grass01').map(({ x, z, rotation }, index) => <GrassLeafs key={index} position={{ x, z }} rotation={rotation} />);
    const plantBushDetailed = worldData.noncollidableObjects.filter((obj) => obj.type === 'plant01').map(({ x, z, rotation }, index) => <PlantBushDetailed key={index} position={{ x, z }} rotation={rotation} />);
    const mushrooms = worldData.noncollidableObjects.filter((obj) => obj.type === 'mushroom01').map(({ x, z, rotation }, index) => <Mushroom key={index} position={{ x, z }} rotation={rotation} />);
    return [trees, houses, grassLeafs, plantBushDetailed, mushrooms];
  }, [worldData]);
  return environment;
});
