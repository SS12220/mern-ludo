process.env.NODE_ENV = 'test';
process.env.PORT = '8081';
require('dotenv').config();
if (!process.env.CONNECTION_URI) {
    process.env.CONNECTION_URI = 'mongodb://127.0.0.1:27017/mern-ludo-test';
}
