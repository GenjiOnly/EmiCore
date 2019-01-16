"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.processTime = processTime;
exports.unprocessTime = unprocessTime;
exports.processPerspectives = processPerspectives;
exports.preventUpdatePerspectives = preventUpdatePerspectives;
exports.serialize = serialize;
exports.processObjectIDs = processObjectIDs;
exports.convertObjectIDs = convertObjectIDs;
exports.toDates = toDates;
exports.convertDates = convertDates;
exports.populatePreviousObject = populatePreviousObject;
exports.setAsDeleted = setAsDeleted;
exports.setExpireAfter = setExpireAfter;

var _lodash = _interopRequireDefault(require("lodash"));

var _moment = _interopRequireDefault(require("moment"));

var _mongoDb = require("../common/utils/mongoDb");

var _marshall = require("../common/utils/marshall");

var _feathersHooksCommon = require("feathers-hooks-common");

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)("emiGrup:eCore:model:hooks"); // Need to convert from server side types (moment dates) to basic JS types when "writing" to DB adapters

function processTime(hook) {
  let items = (0, _feathersHooksCommon.getItems)(hook);
  const isArray = Array.isArray(items);
  items = isArray ? items : [items];
  items.forEach(item => {
    (0, _marshall.marshallTime)(item, "time");
  });
  (0, _feathersHooksCommon.replaceItems)(hook, isArray ? items : items[0]);
} // Need to convert back to server side types (moment dates) from basic JS types when "reading" from DB adapters


function unprocessTime(hook) {
  let items = (0, _feathersHooksCommon.getItems)(hook);
  const isArray = Array.isArray(items);
  items = isArray ? items : [items];
  items.forEach(item => {
    (0, _marshall.unmarshallTime)(item, "time");
  });
  (0, _feathersHooksCommon.replaceItems)(hook, isArray ? items : items[0]);
}

function processPerspectives(hook) {
  let params = hook.params;
  let query = params.query;
  let service = hook.service; // Test if some perspectives are defined on the model

  if (!service.options || !service.options.perspectives) return; // Iterate through known perspectives of the model

  service.options.perspectives.forEach(perspective => {
    // Only discard if not explicitely asked by $select
    let filterPerspective = true;

    if (!_lodash.default.isNil(query) && !_lodash.default.isNil(query.$select)) {
      // Transform to array to unify processing
      let selectedFields = typeof query.$select === "string" ? [query.$select] : query.$select;

      if (Array.isArray(selectedFields)) {
        selectedFields.forEach(field => {
          // Take care that we might only ask for a subset of perspective fields like ['perspective.fieldName']
          if (field === perspective || field.startsWith(perspective + ".")) {
            filterPerspective = false;
          }
        });
      }
    }

    if (filterPerspective) {
      (0, _feathersHooksCommon.discard)(perspective)(hook);
    }
  });
} // When perspectives are present we disallow update in order to avoid erase them.
// Indeed when requesting an object they are not retrieved by default


function preventUpdatePerspectives(hook) {
  let service = hook.service; // Test if some perspectives are defined on the model

  if (!service.options || !service.options.perspectives) return;
  (0, _feathersHooksCommon.disallow)()(hook);
} // The hook serialize allows to copy/move some properties within the objects holded by the hook
// It applies an array of rules defined by:
// - source: the path to the property to be copied
// - target: the path where to copy the property
// - delete: a flag to define whether the hook has to delete the source property


function serialize(rules, options = {}) {
  return function (hook) {
    // Retrieve the items from the hook
    let items = (0, _feathersHooksCommon.getItems)(hook);
    const isArray = Array.isArray(items);
    items = isArray ? items : [items]; // Apply the rules for each item

    items.forEach(item => {
      rules.forEach(rule => {
        const source = _lodash.default.get(item, rule.source);

        if (!_lodash.default.isNil(source)) {
          _lodash.default.set(item, rule.target, source);

          if (rule.delete) {
            _lodash.default.unset(item, rule.source);
          }
        } else if (options.throwOnNotFound || rule.throwOnNotFound) {
          throw new Error("Cannot find valid input value for property " + rule.target);
        }
      });
    }); // Replace the items within the hook

    (0, _feathersHooksCommon.replaceItems)(hook, isArray ? items : items[0]);
  };
} // The hook objectify allows to transform the value bound to an '_id' like key as a string
// into a Mongo ObjectId on client queries


function processObjectIDs(hook) {
  if (hook.params.query) (0, _mongoDb.objectifyIDs)(hook.params.query);
  if (hook.data) (0, _mongoDb.objectifyIDs)(hook.data);
  return hook;
} // The hook convert allows to transform a set of input properties as a string
// into a Mongo ObjectId on client queries


function convertObjectIDs(properties) {
  return function (hook) {
    if (hook.params.query) (0, _mongoDb.toObjectIDs)(hook.params.query, properties);
    if (hook.data) (0, _mongoDb.toObjectIDs)(hook.data, properties);
    return hook;
  };
} // Utility function used to convert from string to Dates a fixed set of properties on a given object


function toDates(object, properties, asMoment) {
  properties.forEach(property => {
    let date = _lodash.default.get(object, property);

    if (date) {
      // We use moment to validate the date
      date = _moment.default.utc(date);

      if (date.isValid()) {
        if (!asMoment) {
          date = date.toDate();
        }

        _lodash.default.set(object, property, date);
      }
    }
  });
} // The hook allows to transform a set of input properties as a string
// into a Date/Moment object on client queries


function convertDates(properties, asMoment) {
  return function (hook) {
    if (hook.params.query) toDates(hook.params.query, properties, asMoment);
    if (hook.data) toDates(hook.data, properties, asMoment);
    return hook;
  };
}

async function populatePreviousObject(hook) {
  if (hook.type !== "before") {
    throw new Error(`The 'populatePreviousObject' hook should only be used as a 'before' hook.`);
  }

  let item = (0, _feathersHooksCommon.getItems)(hook);
  let id = item._id || hook.id; // Retrieve previous version of the item and make it available to next hooks

  if (id) {
    try {
      hook.params.previousItem = await hook.service.get(id.toString());
    } catch (error) {}

    debug("Populated previous object", hook.params.previousItem);
  }

  return hook;
}

function setAsDeleted(hook) {
  // Retrieve the items from the hook
  let items = (0, _feathersHooksCommon.getItems)(hook);
  const isArray = Array.isArray(items);
  items = isArray ? items : [items]; // Apply the rules for each item

  items.forEach(item => _lodash.default.set(item, "deleted", true)); // Replace the items within the hook

  (0, _feathersHooksCommon.replaceItems)(hook, isArray ? items : items[0]);
  return hook;
}

function setExpireAfter(delayInSeconds) {
  return function (hook) {
    if (hook.type !== "before") {
      throw new Error(`The 'setExpireAfter' hook should only be used as a 'before' hook.`);
    } // Retrieve the items from the hook


    let items = (0, _feathersHooksCommon.getItems)(hook);
    const isArray = Array.isArray(items);
    items = isArray ? items : [items]; // Apply the rules for each item

    let date = new Date(Date.now() + 1000 * delayInSeconds);
    items.forEach(item => _lodash.default.set(item, "expireAt", date)); // Replace the items within the hook

    (0, _feathersHooksCommon.replaceItems)(hook, isArray ? items : items[0]);
    return hook;
  };
}