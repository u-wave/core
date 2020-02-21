function isMongoConnected(mongo) {
  if (mongo.readyState === 1) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    mongo.once('open', resolve);
  });
}

module.exports = isMongoConnected;
