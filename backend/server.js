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
        origin: true,
        credentials: true,
    })
);

let server;

async function startServer() {
    if (!process.env.CONNECTION_URI) {
        const { MongoMemoryReplSet } = require('mongodb-memory-server');
        const mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
        process.env.CONNECTION_URI = mongoServer.getUri();
    }
    
    const { sessionMiddleware } = require('./config/session');
    app.use(sessionMiddleware);

    server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server listening on port ${PORT}`);
    });

    // Agora Token Generator Endpoint
    app.get('/api/agora/token', (req, res) => {
        const { channelName } = req.query;
        if (!channelName) {
            return res.status(400).json({ error: 'channelName is required' });
        }

        const appID = process.env.AGORA_APP_ID;
        const appCertificate = process.env.AGORA_APP_CERTIFICATE;
        
        // We use a wildcard UID (0) to let Agora assign random UIDs to users joining.
        const uid = 0; 
        
        // Expiration time: 24 hours
        const expirationTimeInSeconds = 3600 * 24;
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
        const token = RtcTokenBuilder.buildTokenWithUid(
            appID,
            appCertificate,
            channelName,
            uid,
            RtcRole.PUBLISHER,
            privilegeExpiredTs
        );

        res.json({ token, appId: appID });
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

module.exports = { server: app, getHttpServer: () => server };
