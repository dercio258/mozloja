const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'ecomercedb',
    process.env.DB_USER || 'dercio123',
    process.env.DB_PASS || 'ecomercedbpass',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false, // Set to console.log to see SQL queries
    }
);

module.exports = sequelize;
