const mysql = require("mysql2");

require("dotenv").config();
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
})
const database = pool.promise();
module.exports = database;