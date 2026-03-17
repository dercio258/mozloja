const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Sale = sequelize.define('Sale', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    product: {
        type: DataTypes.STRING,
        allowNull: false
    },
    customer: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    vendedor_id: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    external_reference: {
        type: DataTypes.STRING,
        allowNull: true
    },
    firstAccessedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    payout_amount: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    affiliate_commission: {
        type: DataTypes.FLOAT,
        allowNull: true
    },
    utm_source: { type: DataTypes.STRING, allowNull: true },
    utm_medium: { type: DataTypes.STRING, allowNull: true },
    utm_campaign: { type: DataTypes.STRING, allowNull: true },
    utm_content: { type: DataTypes.STRING, allowNull: true },
    utm_term: { type: DataTypes.STRING, allowNull: true },
    src: { type: DataTypes.STRING, allowNull: true },
    sck: { type: DataTypes.STRING, allowNull: true },
    gateway_id: { type: DataTypes.STRING, allowNull: true }
}, {
    tableName: 'sales',
    timestamps: true // adds createdAt and updatedAt
});

module.exports = Sale;
