const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    image: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    content_link: {
        type: DataTypes.STRING,
        allowNull: false
    },
    pixel_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    utmify_id: {
        type: DataTypes.STRING,
        allowNull: true
    },
    webhook_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    vendedor_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'products',
    timestamps: true
});

module.exports = Product;
