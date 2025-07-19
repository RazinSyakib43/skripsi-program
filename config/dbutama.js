const { Pool } = require("pg");

const dbutama = new Pool({
    host: '43.0.2.40',
    user: "postgres",
    password: "yessgood123",
    database: "startupxyz_db",
    port: 5432,
    connectionTimeoutMillis: 5000, // Timeout after 5 seconds
});

module.exports = dbutama;