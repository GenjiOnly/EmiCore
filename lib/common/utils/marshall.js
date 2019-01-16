"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.marshallComparisonFields = marshallComparisonFields;
exports.marshallSortFields = marshallSortFields;
exports.marshallTime = marshallTime;
exports.unmarshallTime = unmarshallTime;

var _moment = _interopRequireDefault(require("moment"));

var _lodash = _interopRequireDefault(require("lodash"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Helper function to convert comparison operator values to numbers or dates
function marshallComparisonFields(queryObject) {
  _lodash.default.forOwn(queryObject, (value, key) => {
    // Process current attributes or  recurse
    if (typeof value === "object") {
      marshallComparisonFields(value);
    } else if (key === "$lt" || key === "$lte" || key === "$gt" || key === "$gte") {
      let number = _lodash.default.toNumber(value); // Update from query string to number if required


      if (!Number.isNaN(number)) {
        queryObject[key] = number;
      } else {
        // try for dates as well
        let date = _moment.default.utc(value);

        if (date.isValid()) {
          queryObject[key] = date.toDate();
        }
      }
    }
  });
} // Helper function to convert sort operator values to numbers


function marshallSortFields(queryObject) {
  _lodash.default.forOwn(queryObject, (value, key) => {
    // Process current attributes or  recurse
    if (typeof value === "object") {
      marshallSortFields(value);
    } else {
      let number = _lodash.default.toNumber(value); // Update from query string to number if required


      if (!Number.isNaN(number)) {
        queryObject[key] = number;
      }
    }
  });
} // Helper function to convert time objects or array of time objects


function marshallTime(item, property) {
  if (!item) return;
  const time = item[property];
  if (!time) return;

  if (Array.isArray(time)) {
    item[property] = time.map(t => {
      if (_moment.default.isMoment(t)) return new Date(t.format());else if (typeof t === "string") return new Date(t);else return t;
    });
  } else if (_moment.default.isMoment(time)) {
    item[property] = new Date(time.format());
  } else if (typeof time === "string") {
    item[property] = new Date(time);
  } else if (typeof time === "object") {
    // Check if complex object such as comparison operator
    // If so this will recurse
    _lodash.default.keys(time).forEach(key => marshallTime(time, key));
  }
} // Helper function to convert time objects or array of time objects


function unmarshallTime(item, property) {
  if (!item) return;
  const time = item[property];
  if (!time) return;

  if (Array.isArray(time)) {
    item[property] = time.map(t => !_moment.default.isMoment(t) ? _moment.default.utc(t.toISOString()) : t);
  } else if (!_moment.default.isMoment(time)) {
    // Check if complex object indexed by element
    const keys = _lodash.default.keys(time); // If so recurse


    if (keys.length > 0) keys.forEach(key => unmarshallTime(time, key));else item[property] = _moment.default.utc(time.toISOString());
  }
}