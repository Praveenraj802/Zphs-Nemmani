const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, default: '' },
    media: {
        type: String, // Path to file (image/video/audio)
        default: null
    },
    mediaType: { type: String, enum: ['image', 'video', 'audio', null], default: null },
    room: { type: String, default: 'zphs-global' }, // Can be user ID (DM) or 'zphs-global'
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);
