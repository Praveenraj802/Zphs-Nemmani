const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/zpns_chat')
    .then(async () => {
        // Delete users where phone length is not 10 OR doesn't start with 6-9
        const regex = /^[6-9]\d{9}$/;
        const allUsers = await User.find({});
        let deletedCount = 0;

        for (const user of allUsers) {
            if (!regex.test(user.phone)) {
                await User.findByIdAndDelete(user._id);
                deletedCount++;
            }
        }

        console.log(`Cleaned up ${deletedCount} fake users.`);
        mongoose.connection.close();
    })
    .catch(err => console.error(err));
