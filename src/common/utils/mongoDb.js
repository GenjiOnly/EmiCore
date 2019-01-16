import _ from "lodash";
import { ObjectID } from "mongodb";
import makeDebug from "debug";

const debug = makeDebug("emiGrup:eCore:utils:mongoDb");

export function isObjectID(id) {
  return (
    id &&
    typeof id.toHexString === "function" &&
    typeof id.getTimestamp === "function"
  );
}

export function createObjectID(id) {
  // This ensure it works even if id is already an ObjectID
  if (isObjectID(id)) return id;
  else if (!ObjectID.isValid(id)) return null;
  else return new ObjectID(id);
}

// Utility function used to convert from string to MongoDB IDs as required eg by queries
export function objectifyIDs(object) {
  _.forOwn(object, (value, key) => {
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
      } else if (typeof value === "object" && !isObjectID(value))
        objectifyIDs(value); // Avoid jumping inside an already transformed ObjectID
    } else if (["$in", "$nin"].includes(key)) {
      debug("Objectify ID array " + key);
      const ids = value.map(id => createObjectID(id)).filter(id => id);
      // Take care that $in/$nin can be used for others types than Object IDs so conversion might fail
      if (ids.length > 0) object[key] = ids;
    } else if (key === "$or") {
      value.forEach(entry => objectifyIDs(entry));
      // Avoid jumping inside an already transformed ObjectID
    } else if (typeof value === "object" && !isObjectID(value)) {
      objectifyIDs(value);
    }
  });
  return object;
}

// Utility function used to convert from string to MongoDB IDs a fixed set of properties on a given object
export function toObjectIDs(object, properties) {
  properties.forEach(property => {
    const id = createObjectID(_.get(object, property));
    if (id) {
      _.set(object, property, id);
    }
  });
}
