"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.MongoDatabase = exports.Database = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _moment = _interopRequireDefault(require("moment"));

var _debug = _interopRequireDefault(require("debug"));

var _mongodb = require("mongodb");

var _errors = _interopRequireDefault(require("@feathersjs/errors"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)("emiGrup:eCore:db"); // This ensure moment objects are correctly serialized in MongoDB

Object.getPrototypeOf((0, _moment.default)()).toBSON = function () {
  return this.toDate();
};

class Database {
  constructor(app) {
    try {
      this.app = app;
      this._adapter = app.get("db").adapter;
    } catch (error) {
      throw new _errors.default.GeneralError("Cannot find database adapter configuration in application");
    }

    this._collections = new Map();
  }

  get adapter() {
    return this._adapter;
  }

  async connect() {
    // Default implementation
    return null;
  }

  static create(app) {
    switch (app.get("db").adapter) {
      case "mongodb":
      default:
        return new MongoDatabase(app);
    }
  }

}

exports.Database = Database;

class MongoDatabase extends Database {
  constructor(app) {
    super(app);

    try {
      this._dbUrl = app.get("db").url;
      this._dbName = app.get("db").name;
      this._client = new _mongodb.MongoClient(this._dbUrl, {
        useNewUrlParser: true
      });
    } catch (error) {
      throw new _errors.default.GeneralError("Cannot find database connection URL in application");
    }
  }

  async connect() {
    try {
      // http://mongodb.github.io/node-mongodb-native/3.1/reference/ecmascriptnext/connecting/
      await this._client.connect();
      this._db = this._client.db(this._dbName);
      debug("Connected to DB " + this.app.get("db").adapter);
      return this._db;
    } catch (error) {
      this.app.logger.error("Could not connect to " + this.app.get("db").adapter + " database, please check your configuration");
      throw error;
    }
  }

  get instance() {
    return this._db;
  }

  collection(name) {
    // Initializes the `collection` on sublevel `collection`
    if (!this._collections.has(name)) {
      this._collections.set(name, this._db.collection(name));
    }

    return this._collections.get(name);
  }

}

exports.MongoDatabase = MongoDatabase;