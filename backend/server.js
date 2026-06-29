const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
require('dotenv').config();

const PORT = process.env.PORT;

const app = express();

app.use(cookieParser());
app.use(
    express.urlencoded({
        extended: true,
    })
);
app.use(express.json());
app.set('trust proxy', 1);
app.use(
    cors({
        origin: 'http://localhost:3000',
        credentials: true,
    })
);

let server;

async function startServer() {
    const { MongoMemoryReplSet } = require('mongodb-memory-server');
    const mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.CONNECTION_URI = mongoServer.getUri();
    
    const { sessionMiddleware } = require('./config/session');
    app.use(sessionMiddleware);

    server = app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });

    require('./config/database')(mongoose);
    require('./config/socket')(server);

    if (process.env.NODE_ENV === 'production') {
        app.use(express.static('./build'));
        app.get('*', (req, res) => {
            const indexPath = path.join(__dirname, './build/index.html');
            res.sendFile(indexPath);
        });
    }
}

startServer().catch(console.error);

module.exports = { server: app };
