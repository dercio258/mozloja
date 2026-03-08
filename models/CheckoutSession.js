const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CheckoutSession = sequelize.define('CheckoutSession', {
    token: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    productId: {
        type: DataTypes.STRING, // String to accommodate mock IDs like '101' and DB IDs
        allowNull: false
    },
    isMock: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    used: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'checkout_sessions',
    timestamps: true
});

module.exports = CheckoutSession;
