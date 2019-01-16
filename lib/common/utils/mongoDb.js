"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isObjectID = isObjectID;
exports.createObjectID = createObjectID;
exports.objectifyIDs = objectifyIDs;
exports.toObjectIDs = toObjectIDs;

var _lodash = _interopRequireDefault(require("lodash"));

var _mongodb = require("mongodb");

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)("emiGrup:eCore:utils:mongoDb");

function isObjectID(id) {
  return id && typeof id.toHexString === "function" && typeof id.getTimestamp === "function";
}

function createObjectID(id) {
  // This ensure it works even if id is already an ObjectID
  if (isObjectID(id)) return id;else if (!_mongodb.ObjectID.isValid(id)) return null;else return new _mongodb.ObjectID(id);
} // Utility function used to convert from string to MongoDB IDs as required eg by queries


function objectifyIDs(object) {
  _lodash.default.forOwn(object, (value, key) => {
    // Process current attributes or recurse
    // Take care to nested fields like 'field._id'
    if (key === "_id" || key.endsWith("._id") || key === "$ne") {
      if (typeof value === "string") {
        debug("Objectify ID " + key);
        const id = createObjectID(value);

        if (id) {
          object[key] = id;
        }
      } else if (Array.isArray(value)) {
        debug("Objectify ID array " + key);
        object[key] = value.map(id => createObjectID(id)).filter(id => id);
      } else if (typeof value === "object" && !isObjectID(value)) objectifyIDs(value); // Avoid jumping inside an already transformed ObjectID

    } else if (["$in", "$nin"].includes(key)) {
      debug("Objectify ID array " + key);
      const ids = value.map(id => createObjectID(id)).filter(id => id); // Take care that $in/$nin can be used for others types than Object IDs so conversion might fail

      if (ids.length > 0) object[key] = ids;
    } else if (key === "$or") {
      value.forEach(entry => objectifyIDs(entry)); // Avoid jumping inside an already transformed ObjectID
    } else if (typeof value === "object" && !isObjectID(value)) {
      objectifyIDs(value);
    }
  });

  return object;
} // Utility function used to convert from string to MongoDB IDs a fixed set of properties on a given object


function toObjectIDs(object, properties) {
  properties.forEach(property => {
    const id = createObjectID(_lodash.default.get(object, property));

    if (id) {
      _lodash.default.set(object, property, id);
    }
  });
}