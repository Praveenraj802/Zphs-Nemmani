const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// --- PeerJS ---
const peerServer = ExpressPeerServer(server, { debug: true, path: '/' });
app.use('/peerjs', peerServer);

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// --- MongoDB ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zphs-chat';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB Chat Connected'))
    .catch(err => console.error('MongoDB Error:', err));

const UserSchema = new mongoose.Schema({
    phone: { type: String, unique: true, required: true },
    displayName: String,
    avatar: String,
    lastSeen: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: String,
    media: String,
    mediaType: { type: String, enum: ['image', 'video', 'audio', 'none'], default: 'none' },
    room: { type: String, default: 'zphs-global' },
    timestamp: { type: Date, default: Date.now },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
});
const Message = mongoose.model('Message', MessageSchema);

// --- File Upload ---
const storage = multer.diskStorage({
    destination: 'uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// --- API Routes ---

// 1. Auth
app.post('/api/auth/register', async (req, res) => {
    try {
        const { displayName, phone } = req.body;
        let user = await User.findOne({ phone });
        if (user) return res.status(400).json({ success: false, error: 'Phone number already registered' });

        user = await User.create({ displayName, phone });
        res.json({ success: true, user: { id: user._id, name: user.displayName, phone: user.phone } });
    } catch (err) { res.status(500).json({ success: false, error: 'Server error' }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { phone } = req.body;
        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ success: false, error: 'User not found' });
        res.json({ success: true, user: { id: user._id, name: user.displayName, phone: user.phone } });
    } catch (err) { res.status(500).json({ success: false, error: 'Server error' }); }
});

// 2. Messages
app.get('/api/messages/:room', async (req, res) => {
    const msgs = await Message.find({ room: req.params.room }).populate('sender').populate('readBy');
    res.json(msgs);
});

app.delete('/api/messages/:id', async (req, res) => {
    await Message.findByIdAndDelete(req.params.id);
    io.emit('message-deleted', req.params.id);
    res.json({ success: true });
});

// Clear Chat Room
app.delete('/api/messages/room/:room', async (req, res) => {
    try {
        const messages = await Message.find({ room: req.params.room });
        for (let msg of messages) {
            if (msg.media) {
                const filePath = path.join(__dirname, msg.media);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
        }
        await Message.deleteMany({ room: req.params.room });
        io.emit('chat-cleared');
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Delete failed' }); }
});

// 3. User Management
app.delete('/api/users/:id', async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        io.emit('user-deleted', req.params.id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: 'Delete user failed' }); }
});

// 4. Media Upload
app.post('/api/upload', upload.single('media'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const mime = req.file.mimetype;
    let type = 'file';
    if (mime.startsWith('image/')) type = 'image';
    else if (mime.startsWith('video/')) type = 'video';
    else if (mime.startsWith('audio/')) type = 'audio';

    res.json({ url: `/uploads/${req.file.filename}`, type });
});

// 4. User List
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch users' }); }
});

// --- Health Check ---
app.get('/health', (req, res) => res.json({ status: 'ok', serverTime: new Date() }));

// --- Admin Features ---
app.post('/api/users/add', async (req, res) => {
    try {
        const { name, phone } = req.body;
        if (!name || !phone || phone.length < 10) return res.status(400).json({ error: 'Valid Name and 10-digit Phone required' });

        const exists = await User.findOne({ phone });
        if (exists) return res.status(400).json({ error: 'Number already exists' });

        await User.create({ phone, displayName: name });
        res.json({ success: true, message: `Successfully added ${name}` });
    } catch (err) { res.status(500).json({ error: 'Database error' }); }
});

app.post('/api/admin/bulk-import', async (req, res) => {
    try {
        const { textData } = req.body;
        if (!textData) return res.status(400).json({ error: 'No data paste' });
        const numbers = textData.match(/[6-9][0-9]{9}/g) || [];
        const unique = [...new Set(numbers)];
        let count = 0;
        for (let ph of unique) {
            const exists = await User.findOne({ phone: ph });
            if (!exists) {
                await User.create({ phone: ph, displayName: `Member ${ph.slice(-4)}` });
                count++;
            }
        }
        res.json({ success: true, message: `Added ${count} new contacts!` });
    } catch (err) { res.status(500).json({ error: 'Bulk failed' }); }
});

// --- Socket.io ---
io.on('connection', (socket) => {
    socket.on('join-room', ({ userId, room }) => {
        socket.join(room);
        console.log(`User ${userId} joined ${room}`);
    });

    socket.on('send-message', async (data) => {
        const msg = await Message.create({
            sender: data.senderId,
            content: data.content,
            media: data.media,
            mediaType: data.mediaType || 'none',
            room: data.room
        });
        const populated = await Message.findById(msg._id).populate('sender');
        io.to(data.room).emit('receive-message', populated);
    });

    socket.on('mark-read', async ({ messageId, userId, room }) => {
        const msg = await Message.findById(messageId);
        if (msg && !msg.readBy.includes(userId)) {
            msg.readBy.push(userId);
            await msg.save();
            const updated = await Message.findById(messageId).populate('readBy');
            io.to(room).emit('message-updated', updated);
        }
    });

    socket.on('typing', (d) => socket.to(d.room).emit('user-typing', d));
    socket.on('stop-typing', (d) => socket.to(d.room).emit('user-stop-typing', d));

    // Calls
    socket.on('call-user', (data) => {
        socket.to(data.room).emit('call-made', {
            signal: data.signalData,
            from: data.from,
            name: data.name
        });
    });
});

const PORT = process.env.PORT || 3010;
server.listen(PORT, () => console.log(`Chat Server running on port ${PORT}`));
