"use strict";

var _lodash = _interopRequireDefault(require("lodash"));

var _hooks = require("../../hooks");

var _feathersHooksCommon = require("feathers-hooks-common");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = {
  before: {
    all: [],
    find: [],
    get: [(0, _feathersHooksCommon.disallow)('external')],
    create: [_hooks.populateTagResource, (0, _feathersHooksCommon.iff)(hook => _lodash.default.has(hook, 'data.value') && _lodash.default.has(hook, 'data.scope'), _hooks.addTagIfNew)],
    update: [(0, _feathersHooksCommon.disallow)()],
    patch: [(0, _feathersHooksCommon.disallow)('external')],
    // Let the removal of the actual tag object by ID pass without running these hooks
    // Indeed the initial call is used to remove the tag from the resource with the ID of the resource given, not the tag one
    remove: [_hooks.populateTagResource, (0, _feathersHooksCommon.iff)(hook => _lodash.default.has(hook.params, 'query.value') && _lodash.default.has(hook.params, 'query.scope'), _hooks.removeTagIfUnused)]
  },
  after: {
    all: [],
    find: [],
    get: [],
    // Let the tagging of the resource object occur only when resource has been found
    create: [(0, _feathersHooksCommon.iff)(hook => hook.params.resource, _hooks.tagResource)],
    update: [],
    patch: [],
    // Let the untagging of the resource object occur only when resource has been found
    remove: [(0, _feathersHooksCommon.iff)(hook => hook.params.resource, _hooks.untagResource)]
  },
  error: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
};