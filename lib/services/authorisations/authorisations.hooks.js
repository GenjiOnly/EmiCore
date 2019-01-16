"use strict";

var _hooks = require("../../hooks");

module.exports = {
  before: {
    all: [],
    find: [],
    get: [],
    create: [_hooks.populateSubjects, _hooks.populateResource],
    update: [],
    patch: [],
    remove: [_hooks.populateSubjects, _hooks.populateResource]
  },
  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
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