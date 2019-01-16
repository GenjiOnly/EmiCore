module.exports = function(app, options) {
  let db = options.db || app.db;
  const Model = db.collection("tags");
  // Use compound index to have unique pairs scope/value
  Model.createIndex({ scope: 1, value: 1 }, { unique: true });
  return Model;
};
