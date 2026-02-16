const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/zpns_chat')
    .then(async () => {
        const users = await User.find({});
        console.log('Current Users in Database:');
        users.forEach(u => console.log(`Name: ${u.displayName}, Phone: ${u.phone}`));
        mongoose.connection.close();
    })
    .catch(err => console.error(err));
