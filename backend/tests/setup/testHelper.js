const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

async function connectTestDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
}

async function disconnectTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongod) await mongod.stop();
}

async function clearCollections() {
  const cols = mongoose.connection.collections;
  for (const key in cols) {
    await cols[key].deleteMany({});
  }
}

module.exports = { connectTestDB, disconnectTestDB, clearCollections };
