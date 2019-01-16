"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _hooks = require("./hooks.query");

Object.keys(_hooks).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _hooks[key];
    }
  });
});

var _hooks2 = require("./hooks.logger");

Object.keys(_hooks2).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _hooks2[key];
    }
  });
});

var _hooks3 = require("./hooks.model");

Object.keys(_hooks3).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _hooks3[key];
    }
  });
});

var _hooks4 = require("./hooks.users");

Object.keys(_hooks4).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _hooks4[key];
    }
  });
});

var _hooks5 = require("./hooks.tags");

Object.keys(_hooks5).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _hooks5[key];
    }
  });
});

var _hooks6 = require("./hooks.authorisations");

Object.keys(_hooks6).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _hooks6[key];
    }
  });
});

var _hooks7 = require("./hooks.storage");

Object.keys(_hooks7).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _hooks7[key];
    }
  });
});

var _hooks8 = require("./hooks.service");

Object.keys(_hooks8).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function () {
      return _hooks8[key];
    }
  });
});