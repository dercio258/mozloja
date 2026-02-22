const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Withdrawal = sequelize.define('Withdrawal', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    method: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    ref: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'withdrawals',
    timestamps: true
});

module.exports = Withdrawal;
