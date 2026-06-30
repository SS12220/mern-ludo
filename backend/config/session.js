const session = require('express-session');

let store;
if (process.env.NODE_ENV === 'test') {
    store = new session.MemoryStore();
} else {
    const MongoDBStore = require('connect-mongodb-session')(session);
    store = new MongoDBStore({
        uri: process.env.CONNECTION_URI,
        collection: 'sessions',
    });
}
const sessionMiddleware = session({
    store: store,
    credentials: true,
    cookie: {
        httpOnly: false,
        secure: false,
    },
    secret: 'secret',
    saveUninitialized: true,
    resave: true,
    maxAge: 20000,
});

const wrap = expressMiddleware => (socket, next) => expressMiddleware(socket.request, {}, next);

module.exports = { sessionMiddleware, wrap };
