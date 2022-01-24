import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { Vector3 } from 'three';

dotenv.config();

const tickRateMilliseconds = 15;
const PLAYER_SPEED = 10;
const players = {};
const events = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  CONNECTED: 'connected',
};

const frontVector = new Vector3();
const sideVector = new Vector3();
const direction = new Vector3();

const tree01Data = fs.readFileSync('src/data/tree01.json', 'utf8');
const tree01 = JSON.parse(tree01Data);

const house01Data = fs.readFileSync('src/data/house01.json', 'utf8');
const house01 = JSON.parse(house01Data);

const grass01Data = fs.readFileSync('src/data/grass01.json', 'utf8');
const grass01 = JSON.parse(grass01Data);

const plant01Data = fs.readFileSync('src/data/plant01.json', 'utf8');
const plant01 = JSON.parse(plant01Data);

const mushroom01Data = fs.readFileSync('src/data/mushroom01.json', 'utf8');
const mushroom01 = JSON.parse(mushroom01Data);

const playerBoundingBox = {
  bl: {
    x: -1,
    z: -1,
  },
  br: {
    x: -1,
    z: 1,
  },
  fl: {
    x: 1,
    z: -1,
  },
  fr: {
    x: 1,
    z: 1,
  },
};

const worldData = {
  width: 120,
  height: 100,
  depth: 120,
  collidableObjects: [...tree01, ...house01],
  noncollidableObjects: [...grass01, ...plant01, ...mushroom01],
  playerBoundingBox,
  playerSpeed: PLAYER_SPEED,
};

admin.initializeApp({
  credential: admin.credential.cert({
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});

const auth = admin.auth();

// API
const app = express();

app.use((req, res, next) => {
  console.log('Allowed origin', process.env.CLIENT_URL);
  // only allow requests from the client URL
  res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, auth-token');
  res.header('Access-Control-Allow-Methods', 'GET');
  next();
});

// server homepage
app.get('/', (req, res) => {
  res.send(`<div>${getNumberOfConnectedClients()} clients connected</div><a href="${process.env.CLIENT_URL}">Go to client</a>`);
});

// health check API
app.get('/ping', (req, res) => {
  res.sendStatus(200);
});

// send world data to clients for initialisation
app.get('/world', async (req, res) => {
  const token = req.header('auth-token');
  let isAuthenticated = false;
  try {
    isAuthenticated = await auth
      .verifyIdToken(token)
      .then(() => true)
      .catch(() => false);
  } catch (_) {
    return res.sendStatus(401);
  }

  if (isAuthenticated) {
    return res.send({ worldData });
  }

  return res.sendStatus(404);
});

// HTTP(S) SERVER
let server = null;
if (process.env.NODE_ENV === 'development') {
  // during development setup HTTPS using self signed certificate
  const options = {
    key: fs.readFileSync(process.env.KEY),
    cert: fs.readFileSync(process.env.CERT),
  };
  server = https.createServer(options, app);
} else {
  // in production auto redirects will redirect all http traffic to https
  // so no need for SSL certs
  server = http.createServer(app);
}

server.listen(process.env.PORT, () => {
  console.log(`Server is running...`);
});

// WEBSOCKET
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL,
  },
});

// token authentication when clients connect
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const isAuthenticated = await auth
    .verifyIdToken(token)
    .then(() => true)
    .catch(() => false);
  if (token && isAuthenticated) {
    next();
  } else {
    next(new Error('You are not authorised to make a connection to this server'));
  }
});

const getNumberOfConnectedClients = () => {
  return io.engine.clientsCount;
};

io.on(events.CONNECTION, (client) => {
  console.log(`User ${client.handshake.auth.userId} connected on socket ${client.id}, there are currently ${getNumberOfConnectedClients()} users connected`);

  players[client.handshake.auth.userId] = {
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    rotation: 0,
    moves: [],
    ts: 0,
  };

  // send client id to signal server authentication
  client.emit(events.CONNECTED, client.id);

  // save updates from the client
  client.on('player_update', ({ id, controls, ts }) => {
    if (id && players[id]) {
      controls && ts && players[id].moves.push({ ts, controls });
    }
  });

  client.once(events.DISCONNECT, () => {
    console.log(`User ${client.handshake.auth.userId} disconnected`);

    delete players[client.handshake.auth.userId];
    io.sockets.emit('players', players);
  });
});

const runCollisionDetection = (playerData, world) => {
  const playerBBoxRotated = getRotatedRectangle(playerData.rotation, playerData.position, playerBoundingBox);

  const worldObjects = world.collidableObjects;
  for (const worldObject of worldObjects) {
    const objectBBoxRotated = getRotatedRectangle(worldObject.rotation, { x: worldObject.x, z: worldObject.z }, worldObject.bbox);
    if (doPolygonsIntersect(playerBBoxRotated, objectBBoxRotated)) {
      // end the loop and signal a collision
      return true;
    }
  }

  return false;
};

const updatePlayerPosition = (player, playerSpeed, delta, world) => {
  const newPosition = { ...player.position };
  if (player.controls.left) newPosition.x -= playerSpeed * delta;
  if (player.controls.right) newPosition.x += playerSpeed * delta;
  if (player.controls.forward) newPosition.z -= playerSpeed * delta;
  if (player.controls.backward) newPosition.z += playerSpeed * delta;

  // if player leaves world boundaries position them on the other side of the world
  // this gives the illusion that the player is running around on a sphere
  if (newPosition.x < -world.width) newPosition.x = world.width;
  if (newPosition.x > world.width) newPosition.x = -world.width;
  if (newPosition.z < -world.depth) newPosition.z = world.depth;
  if (newPosition.z > world.depth) newPosition.z = -world.depth;

  return newPosition;
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

// rotate bounding box points around the objects center at an angle
const getRotatedRectangle = (angle, objCenter, bbox) => {
  let bl = rotatePoint(angle, objCenter.x, objCenter.z, objCenter.x + bbox.bl.x, objCenter.z + bbox.bl.z);
  let br = rotatePoint(angle, objCenter.x, objCenter.z, objCenter.x + bbox.br.x, objCenter.z + bbox.br.z);
  let fr = rotatePoint(angle, objCenter.x, objCenter.z, objCenter.x + bbox.fr.x, objCenter.z + bbox.fr.z);
  let fl = rotatePoint(angle, objCenter.x, objCenter.z, objCenter.x + bbox.fl.x, objCenter.z + bbox.fl.z);
  return [bl, br, fr, fl];
};

const isUndefined = (value) => {
  return value === undefined;
};

//  Separating Axis Theorem
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

const pick = ['left', 'right', 'forward', 'backward'];
const getRandomInt = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateRandomPlayers = () => {
  // randomly move the players around
  for (let p = 0; p < 100; p++) {
    const controls = {
      left: false,
      right: false,
      forward: false,
      backward: false,
    };
    const index = getRandomInt(0, 3);
    const direction = pick[index];
    controls[direction] = true;
    players['player' + p].moves.push({ ts: Date.now(), controls });
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
      moves: [],
      ts: 0,
    };
  }
};

// initRandomPlayers();
// setInterval(() => {
//   generateRandomPlayers();
// }, 33);

setInterval(() => {
  tick();
}, tickRateMilliseconds);

let prevTime = 0;
const tick = () => {
  const now = Date.now();
  const delta = (now - prevTime) / 1000;
  // for each player, update player position based on world, objects, and collision data
  for (let key of Object.keys(players)) {
    while (players[key].moves.length > 0) {
      const move = players[key].moves.shift();

      // apply rotation to player based on controls
      frontVector.set(0, 0, Number(move.controls.backward) - Number(move.controls.forward));
      sideVector.set(Number(move.controls.left) - Number(move.controls.right), 0, 0);
      direction.subVectors(frontVector, sideVector);
      const rotation = Math.atan2(direction.z, direction.x);

      // collision detection based on new position
      const newPosition = updatePlayerPosition({ position: players[key].position, controls: move.controls }, PLAYER_SPEED, delta, worldData);

      const updatedPlayerData = { rotation, position: newPosition };
      const isPlayerColliding = runCollisionDetection(updatedPlayerData, worldData);

      if (!isPlayerColliding) {
        players[key].position = newPosition;
        players[key].rotation = rotation;
      }

      // record the latest processed move timestamp
      players[key].ts = move.ts;
    }
  }
  updateAllPlayers();

  prevTime = now;
};

const updateAllPlayers = () => {
  // send all clients all player data
  io.sockets.emit('world_update', players);
};
