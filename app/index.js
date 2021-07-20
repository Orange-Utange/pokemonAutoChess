require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const Colyseus = require('colyseus');
const monitor = require('@colyseus/monitor').monitor;
const hooks = require('@colyseus/social').hooks;
const socialMiddleware = require('@colyseus/social/express').default;
const validator = require('email-validator');
const basicAuth = require('express-basic-auth');
const {WebSocketTransport} = require("@colyseus/ws-transport");


const port = process.env.PORT || 9000;

const app = express();
const httpServer = http.createServer(app);
const gameServer = new Colyseus.Server({
    transport: new WebSocketTransport({
        server: httpServer
    })
});

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public', 'dist')));

// Routing

app.use('/', socialMiddleware);

// set up rate limiter: maximum of five requests per minute
var RateLimit = require('express-rate-limit');
var limiter = new RateLimit({
  windowMs: 1*60*1000, // 1 minute
  max: 20
});

// apply rate limiter to all requests
app.use(limiter);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

const basicAuthMiddleware = basicAuth({
  // list of users and passwords
  users: {
    'admin': process.env.ADMIN_PASSWORD
  },
  // sends WWW-Authenticate header, which will prompt the user to fill
  // credentials in
  challenge: true
});

app.use('/colyseus', basicAuthMiddleware, monitor());

hooks.beforeAuthenticate((provider, $setOnInsert, $set) => {
  if (provider == 'email' && !validator.validate($set.email)) {
    throw new Error('email is not valid');
  };

  $setOnInsert.metadata = {
    avatar: 'rattata',
    wins: 0,
    exp: 0,
    level: 0,
    elo: 1000,
    donor: false,
    mapWin: {
      ICE: 0,
      FIRE: 0,
      GROUND: 0,
      NORMAL: 0,
      GRASS: 0,
      WATER: 0
    },
    map:{
      ICE: 'ICE0',
      FIRE: 'FIRE0',
      GROUND: 'GROUND0',
      NORMAL: 'NORMAL0',
      GRASS: 'GRASS0',
      WATER: 'WATER0'
    }
  };
});

// Room
const AfterGameRoom = require('./rooms/after-game-room');
const LobbyRoom = require('./rooms/custom-lobby-room');
const PreprationRoom = require('./rooms/preparation-room');
const GameRoom = require('./rooms/game-room');

gameServer.define('after-game', AfterGameRoom);
gameServer.define('lobby', LobbyRoom);
gameServer.define('room', PreprationRoom).enableRealtimeListing();
gameServer.define('game', GameRoom);

// Start
gameServer.listen(port);
console.log(`Game server started, listening on port ${port}`);
