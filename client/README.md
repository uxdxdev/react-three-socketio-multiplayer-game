# Development Setup

NodeJS 16 supported, there seems to be an issue at the moment with SSL in NodeJS 17 using CRA

Create self signed certificate by installing [mkcert](https://github.com/FiloSottile/mkcert) for https in development

```bash
# create local Certificate Authority
mkcert -install
# create localhost.pem and localhost-key.pem files
mkcert localhost
```

Update `.env` file

```properties
REACT_APP_SERVER_URL=https://localhost:3001
```

Update the `script` section of the `package.json` file to point to the `*.pem` files

```properties
### MacOS
{
"scripts": {
    "dev": "HTTPS=true SSL_CRT_FILE=localhost.pem SSL_KEY_FILE=localhost-key.pem npm start",
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}
```

```properties
### Windows
# !! do not put spaces before or after &&
{
"scripts": {
    "dev": "set HTTPS=true&&set SSL_CRT_FILE=localhost.pem&&set SSL_KEY_FILE=localhost-key.pem&&npm start",
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}
```

Unstall all dependencies

```bash
npm ci
```

Start dev server

```bash
npm dev
```
