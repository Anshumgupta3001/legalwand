const mongoose = require('mongoose');

const connectDB = async (retries = 5, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt}/${retries} failed: ${error.message}`);

      if (error.message.includes('whitelist') || error.message.includes('IP')) {
        console.error('   ⚠️  Your IP is not whitelisted on MongoDB Atlas.');
        console.error('   Go to Atlas → Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)');
      }

      if (attempt < retries) {
        console.log(`   Retrying in ${delay / 1000}s...\n`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.error('\n💀 Could not connect to MongoDB after all retries. Server will exit.\n');
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;
