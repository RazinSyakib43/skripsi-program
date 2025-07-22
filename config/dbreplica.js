const { Pool } = require("pg");

const dbreplica = new Pool({
    host: '43.0.2.50',
    user: "postgres",
    password: "yessgood123",
    database: "startupxyz_db",
    port: 5432,
});

module.exports = dbreplica;