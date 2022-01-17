# Development Setup

- to use ES6 JavaScript syntax with the NodeJS runtime we need to set `"type": "module"` in our package.json file

- create self signed certificate by installing [mkcert](https://github.com/FiloSottile/mkcert) for https in development

```bash
# create local Certificate Authority
mkcert -install
# create localhost.pem and localhost-key.pem files
mkcert localhost
```

- update `.env` file with the following details

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

- for authentication you need to create a Firebase project and update the `.env` file with the following details

```properties
# Firebase project details for authentication
FIREBASE_PROJECT_ID="gam...e8"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG...h5PsjnZH+SjGlQ==\n-----END PRIVATE KEY-----\n",
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-....iceaccount.com"
```

- install all dependencies

```bash
npm ci
```

- start dev server

```bash
npm dev
```

- now go setup the client
