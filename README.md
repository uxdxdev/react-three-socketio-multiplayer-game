![](./docs/images/multiplayer-game-banner.PNG)

ReactJS + ThreeJS + socket.io

![](./docs/images/multiplayer-game.PNG)

# Development Setup

To use ES6 JavaScript syntax with the NodeJS runtime we need to set `"type": "module"` in our package.json file

Create self signed certificate by installing [mkcert](https://github.com/FiloSottile/mkcert) for https in development

```bash
# create local Certificate Authority
mkcert -install
# create localhost.pem and localhost-key.pem files
mkcert localhost
```

Update `.env` file with the following details

```properties
# set our Node environment during development
NODE_ENV=development
# used for CORS to only allow requests from client
CLIENT_URL=https://localhost:3000
# used to setup https during development
KEY=localhost-key.pem
CERT=localhost.pem
# server port
PORT=3001
```

For authentication you need to create a Firebase project and update the `.env` file with the following details

```properties
# Firebase project details for authentication
FIREBASE_PROJECT_ID="gam...e8"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG...h5PsjnZH+SjGlQ==\n-----END PRIVATE KEY-----\n",
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-....iceaccount.com"
```

Install all dependencies

```bash
npm ci
```

Start dev server

```bash
npm dev
```

Now go setup the client
