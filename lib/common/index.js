"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.permissions = exports.errors = void 0;

var errors = _interopRequireWildcard(require("./errors"));

exports.errors = errors;

var permissions = _interopRequireWildcard(require("./permissions"));

exports.permissions = permissions;

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = Object.defineProperty && Object.getOwnPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : {}; if (desc.get || desc.set) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } } newObj.default = obj; return newObj; } }