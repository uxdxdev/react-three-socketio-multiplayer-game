import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { Vector3 } from 'three';

const tickRateMilliseconds = 15.625; // server update in milliseconds
const PLAYER_SPEED = 0.2;
const players = {};
const events = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  CONNECTED: 'connected',
};

const frontVector = new Vector3();
const sideVector = new Vector3();
const direction = new Vector3();

const treeData = fs.readFileSync('src/data/trees.data', 'utf8');
const trees = JSON.parse(treeData);

const houseData = fs.readFileSync('src/data/houses.data', 'utf8');
const houses = JSON.parse(houseData);

const playerBoundingBox = {
  bl: {
    x: -0.5,
    z: -0.5,
  },
  br: {
    x: -0.5,
    z: 0.5,
  },
  fl: {
    x: 2,
    z: -0.5,
  },
  fr: {
    x: 2,
    z: 0.5,
  },
};

const worldData = {
  width: 100,
  height: 100,
  depth: 100,
  objects: [...trees, ...houses],
  playerBoundingBox,
};

dotenv.config();

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

// server homepage
app.get('/', (req, res) => {
  res.send(`<div>${getNumberOfConnectedClients()} clients connected</div><a href="${process.env.CLIENT_URL}">Go to client</a>`);
});

// health check API
app.get('/ping', (req, res) => {
  res.sendStatus(200);
});

// Cross-origin resource sharing settings
let ALLOWED_ORIGINS = ['https://localhost:3000', process.env.CLIENT_URL];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  let allowedOrigins = ALLOWED_ORIGINS.indexOf(origin) >= 0 ? origin : ALLOWED_ORIGINS[0];

  console.log('allowedOrigins', allowedOrigins);
  // only allow requests from the client URL
  res.header('Access-Control-Allow-Origin', allowedOrigins);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, auth-token');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  next();
});

// send world data to clients for initialisation
app.get('/world', async (req, res) => {
  const token = req.header('auth-token');
  const isAuthenticated = await auth
    .verifyIdToken(token)
    .then(() => true)
    .catch(() => false);

  if (isAuthenticated) {
    res.send({ worldData });
  } else {
    res.sendStatus(401);
  }
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
    origin: ALLOWED_ORIGINS,
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
    controls: {
      left: false,
      right: false,
      forward: false,
      backward: false,
    },
    timestamp: 0,
  };

  // send client id to signal server authentication
  client.emit(events.CONNECTED, client.id);

  // get updates from the client
  client.on('player_update', (data) => {
    if (data.id && data.controls && players[data.id]) {
      players[data.id].controls.left = data.controls.left;
      players[data.id].controls.right = data.controls.right;
      players[data.id].controls.forward = data.controls.forward;
      players[data.id].controls.backward = data.controls.backward;
    }
  });

  client.once(events.DISCONNECT, () => {
    console.log(`User ${client.handshake.auth.userId} disconnected`);

    delete players[client.handshake.auth.userId];
    io.sockets.emit('players', players);
  });
});

setInterval(() => {
  main();
}, tickRateMilliseconds);

const main = () => {
  // for each player, update player position based on world, objects, and collision data
  for (let key of Object.keys(players)) {
    const playerData = players[key];

    const moving = playerData.controls.left || playerData.controls.right || playerData.controls.forward || playerData.controls.backward;
    // if (!moving) continue;

    // apply rotation to player based on controls
    frontVector.set(0, 0, Number(playerData.controls.backward) - Number(playerData.controls.forward));
    sideVector.set(Number(playerData.controls.left) - Number(playerData.controls.right), 0, 0);
    direction.subVectors(frontVector, sideVector);
    const rotation = Math.atan2(direction.z, direction.x);

    // update position
    const newPosition = updatePlayerPosition(playerData, worldData);

    // collision detection based on new position
    const updatedPlayerData = { rotation, position: newPosition };
    const isPlayerColliding = runCollisionDetection(updatedPlayerData, worldData);

    // if collision use previous position instead of new position
    players[key].position = isPlayerColliding ? playerData.position : newPosition;

    // only update the rotation if the player is moving, this keeps the player orientated correctly when they stop moving
    players[key].rotation = moving ? rotation : players[key].rotation;

    // players[key].controls = {
    //   left: false,
    //   right: false,
    //   forward: false,
    //   backward: false,
    // };

    players[key].timestamp = Date.now();
  }
  // send all clients all player data
  io.sockets.emit('players', players);
};

const runCollisionDetection = (playerData, world) => {
  const playerBBoxRotated = getRotatedRectangle(playerData.rotation, playerData.position, playerBoundingBox);

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

const updatePlayerPosition = (player, world) => {
  const newPosition = { ...player.position };
  if (player.controls.left) newPosition.x -= PLAYER_SPEED;
  if (player.controls.right) newPosition.x += PLAYER_SPEED;
  if (player.controls.forward) newPosition.z -= PLAYER_SPEED;
  if (player.controls.backward) newPosition.z += PLAYER_SPEED;

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

const generateRandomPlayers = () => {
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

const initRandomPlayers = () => {
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
// initRandomPlayers();
// setInterval(() => {
//   generateRandomPlayers();
// }, 33);
