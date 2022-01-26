import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { getRandomInt, getUpdatedPlayerPositionRotation } from '@uxdx/multiplayer-engine';

dotenv.config();

const tickRateMilliseconds = 50;
const PLAYER_SPEED = 3;
const players = {};
const events = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  CONNECTED: 'connected',
};

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

const pick = ['left', 'right', 'forward', 'backward'];

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

      const { position, rotation } = getUpdatedPlayerPositionRotation(
        {
          x: players[key].position.x,
          z: players[key].position.z,
        },
        players[key].rotation,
        move.controls,
        PLAYER_SPEED,
        delta,
        worldData,
        playerBoundingBox
      );

      players[key].position = position;
      players[key].rotation = rotation;

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
