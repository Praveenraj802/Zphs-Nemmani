const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    avatar: { type: String, default: 'default-avatar.png' },
    status: { type: String, default: 'offline' },
    pushSubscription: { type: Object, default: null } // Stores push notification subscription
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
