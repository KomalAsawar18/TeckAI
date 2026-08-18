const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  console.log("Starting MongoDB binary download...");
  const mongoServer = await MongoMemoryServer.create();
  console.log("MongoDB binary downloaded and server started successfully!");
  const uri = mongoServer.getUri();
  console.log("URI:", uri);
  await mongoServer.stop();
  console.log("Server stopped successfully.");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
