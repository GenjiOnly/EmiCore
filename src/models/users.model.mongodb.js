module.exports = function(app, options) {
  const Model = app.db.collection("users");

  Model.createIndex({ email: 1 }, { unique: true });
  // Collation provided in query ensure sorting to be case insensitive w.r.t. user's language
  // We built indices with collation to cover the most used languages, it requires different naming...
  Model.createIndex(
    { "profile.name": 1 },
    { name: "name-en", collation: { locale: "en", strength: 1 } }
  );
  Model.createIndex(
    { "profile.name": 1 },
    { name: "name-tr", collation: { locale: "tr", strength: 1 } }
  );
  // Inactive user account might expire at a given date
  Model.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
  return Model;
};
