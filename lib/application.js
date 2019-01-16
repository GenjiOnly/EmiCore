"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.declareService = declareService;
exports.configureService = configureService;
exports.createProxyService = createProxyService;
exports.createService = createService;
exports.emiGrup = emiGrup;

var _path = _interopRequireDefault(require("path"));

var _debug = _interopRequireDefault(require("debug"));

var _winston = _interopRequireDefault(require("winston"));

var _lodash = _interopRequireDefault(require("lodash"));

require("winston-daily-rotate-file");

var _compression = _interopRequireDefault(require("compression"));

var _cors = _interopRequireDefault(require("cors"));

var _helmet = _interopRequireDefault(require("helmet"));

var _bodyParser = _interopRequireDefault(require("body-parser"));

var _limiter = require("limiter");

var _expressRateLimit = _interopRequireDefault(require("express-rate-limit"));

var _feathers = _interopRequireDefault(require("@feathersjs/feathers"));

var _configuration = _interopRequireDefault(require("@feathersjs/configuration"));

var _errors = require("@feathersjs/errors");

var _express = _interopRequireDefault(require("@feathersjs/express"));

var _rest = _interopRequireDefault(require("@feathersjs/express/rest"));

var _socketio = _interopRequireDefault(require("@feathersjs/socketio"));

var _authentication = _interopRequireDefault(require("@feathersjs/authentication"));

var _authenticationJwt = _interopRequireDefault(require("@feathersjs/authentication-jwt"));

var _authenticationLocal = _interopRequireDefault(require("@feathersjs/authentication-local"));

var _authenticationOauth = _interopRequireDefault(require("@feathersjs/authentication-oauth2"));

var _passportGithub = _interopRequireDefault(require("passport-github"));

var _passportGoogleOauth = _interopRequireDefault(require("passport-google-oauth20"));

var _verifier = _interopRequireDefault(require("./common/utils/verifier"));

var _passwordValidator = _interopRequireDefault(require("password-validator"));

var _mongodb = require("mongodb");

var _db = require("./db");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)("emiGrup:eCore:application");
const debugLimiter = (0, _debug.default)("emiGrup:eCore:application:limiter");

function auth() {
  const app = this;
  const config = app.get("authentication");
  if (!config) return;
  const limiter = config.limiter;

  if (limiter && limiter.http) {
    app.use(config.path, new _expressRateLimit.default(limiter.http));
  } // Store availalbe OAuth2 providers


  app.authenticationProviders = []; // Get access to password validator if a policy is defined

  if (config.passwordPolicy) {
    let validator;

    app.getPasswordPolicy = function () {
      // Create on first access, should not be done outside a function because the app has not yet been correctly initialized
      if (validator) return validator;
      let {
        minLength,
        maxLength,
        uppercase,
        lowercase,
        digits,
        symbols,
        noSpaces,
        prohibited
      } = config.passwordPolicy;
      validator = new _passwordValidator.default();
      if (minLength) validator.is().min(minLength);
      if (maxLength) validator.is().max(maxLength);
      if (uppercase) validator.has().uppercase();
      if (lowercase) validator.has().lowercase();
      if (digits) validator.has().digits();
      if (symbols) validator.has().symbols();
      if (noSpaces) validator.not().spaces();
      if (prohibited) validator.is().not().oneOf(prohibited); // Add util functions/options to compare with previous passwords stored in history when required

      const verifier = new _authenticationLocal.default.Verifier(app, _lodash.default.merge({
        usernameField: "email",
        passwordField: "password"
      }, _lodash.default.pick(config, ["service"]), config.local));
      validator.comparePassword = verifier._comparePassword;
      validator.options = config.passwordPolicy;
      return validator;
    };
  } // Set up authentication with the secret


  app.configure((0, _authentication.default)(config));
  app.configure((0, _authenticationJwt.default)());
  app.configure((0, _authenticationLocal.default)());

  if (config.github) {
    app.configure((0, _authenticationOauth.default)({
      name: "github",
      Strategy: _passportGithub.default,
      Verifier: _verifier.default
    }));
    app.authenticationProviders.push("github");
  }

  if (config.google) {
    app.configure((0, _authenticationOauth.default)({
      name: "google",
      Strategy: _passportGoogleOauth.default,
      Verifier: _verifier.default
    }));
    app.authenticationProviders.push("google");
  } // The `authentication` service is used to create a JWT.
  // The before `create` hook registers strategies that can be used
  // to create a new valid JWT (e.g. local or oauth2)


  app.getService("authentication").hooks({
    before: {
      create: [_authentication.default.hooks.authenticate(config.strategies)],
      remove: [_authentication.default.hooks.authenticate("jwt")]
    }
  });
}

function declareService(path, app, service, middlewares = {}) {
  const feathersPath = app.get("apiPath") + "/" + path;
  let feathersService = app.service(feathersPath); // Some internal Feathers service might internally declare the service

  if (feathersService) {
    return feathersService;
  } // Initialize our service by providing any middleware as well


  let args = [feathersPath];
  if (middlewares.before) args = args.concat(middlewares.before);
  args.push(service);
  if (middlewares.after) args = args.concat(middlewares.after);
  if (args.length) app.use.apply(app, args);
  debug("Service declared on path " + feathersPath); // Return the Feathers service, ie base service + Feathers' internals

  feathersService = app.service(feathersPath);
  return feathersService;
}

function configureService(name, service, servicesPath) {
  try {
    const hooks = require(_path.default.join(servicesPath, name, name + ".hooks"));

    service.hooks(hooks);
    debug(name + " service hooks configured on path " + servicesPath);
  } catch (error) {
    debug("No " + name + " service hooks configured on path " + servicesPath);

    if (error.code !== "MODULE_NOT_FOUND") {
      // Log error in this case as this might be linked to a syntax error in required file
      debug(error);
    } // As this is optionnal this require has to fail silently

  }

  try {
    const channels = require(_path.default.join(servicesPath, name, name + ".channels"));

    _lodash.default.forOwn(channels, (publisher, event) => {
      if (event === "all") service.publish(publisher);else service.publish(event, publisher);
    });

    debug(name + " service channels configured on path " + servicesPath);
  } catch (error) {
    debug("No " + name + " service channels configured on path " + servicesPath);

    if (error.code !== "MODULE_NOT_FOUND") {
      // Log error in this case as this might be linked to a syntax error in required file
      debug(error);
    } // As this is optionnal this require has to fail silently

  }

  return service;
}

function createProxyService(options) {
  const targetService = options.service;

  function proxyParams(params) {
    if (options.params) {
      let proxiedParams;

      if (options.params === "function") {
        proxiedParams = options.params(params);
      } else {
        proxiedParams = _lodash.default.merge(params, options.params);
      }

      return proxiedParams;
    } else return params;
  }

  function proxyId(id) {
    if (options.id) return options.id(id);else return id;
  }

  function proxyData(data) {
    if (options.data) return options.data(data);else return data;
  }

  function proxyResult(data) {
    if (options.result) return options.result(data);else return data;
  }

  return {
    async find(params) {
      return proxyResult((await targetService.find(proxyParams(params))));
    },

    async get(id, params) {
      return proxyResult((await targetService.get(proxyId(id), proxyParams(params))));
    },

    async create(data, params) {
      return proxyResult((await targetService.create(proxyData(data), proxyParams(params))));
    },

    async update(id, data, params) {
      return proxyResult((await targetService.update(proxyId(id), proxyData(data), proxyParams(params))));
    },

    async patch(id, data, params) {
      return proxyResult((await targetService.patch(proxyId(id), proxyData(data), proxyParams(params))));
    },

    async remove(id, params) {
      return proxyResult((await targetService.remove(proxyId(id), proxyParams(params))));
    }

  };
}

function createService(name, app, options = {}) {
  const createFeathersService = require("feathers-" + app.db.adapter);

  const paginate = app.get("paginate");
  let serviceOptions = Object.assign({
    name,
    paginate
  }, options); // For DB services a model has to be provided

  let fileName = options.fileName || name;
  let dbService = false;

  try {
    if (serviceOptions.modelsPath) {
      const configureModel = require(_path.default.join(serviceOptions.modelsPath, fileName + ".model." + app.db.adapter));

      serviceOptions.Model = configureModel(app, serviceOptions);
      dbService = true;
    }
  } catch (error) {
    debug("No " + fileName + " service model configured on path " + options.modelsPath);

    if (error.code !== "MODULE_NOT_FOUND") {
      // Log error in this case as this might be linked to a syntax error in required file
      debug(error);
    } // As this is optionnal this require has to fail silently

  } // Initialize our service with any options it requires


  let service;

  if (dbService) {
    service = createFeathersService(serviceOptions); // service.options içerisinde bulunan id değeri atanır

    serviceOptions = service.options;
  } else if (serviceOptions.proxy) {
    service = createProxyService(serviceOptions.proxy);
  } else {
    // Otherwise we expect the service to be provided as a Feathers service interface
    service = require(_path.default.join(serviceOptions.servicesPath, fileName, fileName + ".service")); // If we get a function try to call it assuming it will return the service object

    if (typeof service === "function") {
      service = service(name, app, Object.assign({}, serviceOptions));
    } else if (typeof service === "object" && service.default) {
      if (typeof service.default === "function") service = service.default(name, app, Object.assign({}, serviceOptions));else service = service.default;
    } // Need to set this manually for services not using class inheritance or default adapters


    if (serviceOptions.events) service.events = serviceOptions.events;
  } // Get our initialized service so that we can register hooks and filters


  let servicePath = serviceOptions.path || name;
  let contextId;

  if (serviceOptions.context) {
    contextId = typeof serviceOptions.context === "object" ? _mongodb.ObjectID.isValid(serviceOptions.context) ? serviceOptions.context.toString() : serviceOptions.context._id.toString() : serviceOptions.context;
    servicePath = contextId + "/" + servicePath;
  }

  service = declareService(servicePath, app, service, serviceOptions.middlewares); // Register hooks and event filters

  service = configureService(fileName, service, serviceOptions.servicesPath); // Optionnally a specific service mixin can be provided, apply it

  if (dbService && serviceOptions.servicesPath) {
    try {
      let serviceMixin = require(_path.default.join(serviceOptions.servicesPath, fileName, fileName + ".service")); // If we get a function try to call it assuming it will return the mixin object


      if (typeof serviceMixin === "function") {
        serviceMixin = serviceMixin(fileName, app, Object.assign({}, serviceOptions));
      } else if (typeof serviceMixin === "object" && serviceMixin.default) {
        if (typeof serviceMixin.default === "function") serviceMixin = serviceMixin.default(fileName, app, Object.assign({}, serviceOptions));else serviceMixin = serviceMixin.default;
      }

      service.mixin(serviceMixin);
    } catch (error) {
      debug("No " + fileName + " service mixin configured on path " + serviceOptions.servicesPath);

      if (error.code !== "MODULE_NOT_FOUND") {
        // Log error in this case as this might be linked to a syntax error in required file
        debug(error);
      } // As this is optionnal this require has to fail silently

    }
  } // Then configuration


  service.name = name;
  service.app = app;
  service.options = serviceOptions;
  service.path = servicePath;
  service.context = options.context; // Add some utility functions

  service.getPath = function (withApiPrefix) {
    let path = service.path;

    if (withApiPrefix) {
      path = app.get("apiPath") + "/" + path;
    }

    return path;
  };

  service.getContextId = function () {
    return contextId; // As string
  };

  debug(service.name + " service registration completed");
  app.emit("service", service);
  return service;
}

function setupLogger(logsConfig) {
  // Create corresponding winston transports with options
  const transports = logsConfig ? Object.keys(logsConfig).map(key => {
    const options = logsConfig[key]; // Setup default log level if not defined

    if (!options.level) {
      options.level = process.env.NODE_ENV === "development" ? "debug" : "info";
    }

    return new _winston.default.transports[key](options);
  }) : [];

  const logger = _winston.default.createLogger({
    format: _winston.default.format.json(),
    transports
  });

  return logger;
}

function tooManyRequests(socket, message, key) {
  debug(message);
  const error = new _errors.TooManyRequests(message, {
    translation: {
      key
    }
  });
  socket.Batolyet("rate-limit", error); // Add a timeout so that error message is correctly handled

  setTimeout(() => socket.disconnect(true), 3000);
}

function setupSockets(app) {
  const apiLimiter = app.get("apiLimiter");
  const authConfig = app.get("authentication");
  const authLimiter = authConfig ? authConfig.limiter : null;
  let connections = {};
  let nbConnections = 0;
  return io => {
    // By default EventBatolyetters will print a warning if more than 10 listeners are added for a particular event.
    // The value can be set to Infinity (or 0) to indicate an unlimited number of listeners.
    io.sockets.setMaxListeners(0);

    const maxConnections = _lodash.default.get(apiLimiter, "websocket.maxConcurrency", 0);

    const maxIpConnections = _lodash.default.get(apiLimiter, "websocket.concurrency", 0);

    io.on("connection", socket => {
      nbConnections++;
      debug(`New socket connection on server with pid ${process.pid}`, socket.id, socket.conn.remoteAddress, nbConnections); // Setup disconnect handler first

      socket.on("disconnect", () => {
        nbConnections--;
        debug(`Socket disconnection on server with pid ${process.pid}`, socket.id, socket.conn.remoteAddress, nbConnections);

        if (maxIpConnections > 0) {
          const nbIpConnections = _lodash.default.get(connections, socket.conn.remoteAddress) - 1;
          debug("Total number of connections for", socket.id, socket.conn.remoteAddress, nbIpConnections);

          _lodash.default.set(connections, socket.conn.remoteAddress, nbIpConnections);
        }
      });

      if (maxConnections > 0) {
        if (nbConnections > maxConnections) {
          tooManyRequests(socket, "Too many concurrent connections (rate limiting)", "RATE_LIMITING_CONCURRENCY");
          return;
        }
      }

      if (maxIpConnections > 0) {
        if (_lodash.default.has(connections, socket.conn.remoteAddress)) {
          const nbIpConnections = _lodash.default.get(connections, socket.conn.remoteAddress) + 1;
          debug("Total number of connections for", socket.id, socket.conn.remoteAddress, nbConnections);

          _lodash.default.set(connections, socket.conn.remoteAddress, nbIpConnections);

          if (nbIpConnections > maxIpConnections) {
            tooManyRequests(socket, "Too many concurrent connections (rate limiting)", "RATE_LIMITING_CONCURRENCY");
            return;
          }
        } else {
          _lodash.default.set(connections, socket.conn.remoteAddress, 1);
        }
      }
      /* For debug purpose: trace all data received
      socket.use((packet, next) => {
        console.log(packet)
        next()
      })
      */


      if (apiLimiter && apiLimiter.websocket) {
        const {
          tokensPerInterval,
          interval
        } = apiLimiter.websocket;
        socket.socketLimiter = new _limiter.RateLimiter(tokensPerInterval, interval);
        socket.use((packet, next) => {
          if (packet.length > 0) {
            // Message are formatted like this 'service_path::service_method'
            let pathAndMethod = packet[0].split("::");

            if (pathAndMethod.length > 0) {
              // const servicePath = pathAndMethod[0]
              debugLimiter(socket.socketLimiter.getTokensRemaining() + " remaining API token for socket", socket.id, socket.conn.remoteAddress);

              if (!socket.socketLimiter.tryRemoveTokens(1)) {
                // if exceeded
                tooManyRequests(socket, "Too many requests in a given amount of time (rate limiting)", "RATE_LIMITING"); // FIXME: calling this causes a client timeout
                // next(error)
                // Need to normalize the error object as JSON
                // let result = {}
                // Object.getOwnPropertyNames(error).forEach(key => (result[key] = error[key]))
                // Trying to send error like in https://github.com/feathersjs/transport-commons/blob/auk/src/events.js#L103
                // does not work either (also generates a client timeout)
                // socket.Batolyet(`${servicePath} error`, result)
                // socket.Batolyet(result)

                return;
              }
            }
          }

          next();
        });
      }

      if (authLimiter && authLimiter.websocket) {
        const {
          tokensPerInterval,
          interval
        } = authLimiter.websocket;
        socket.authSocketLimiter = new _limiter.RateLimiter(tokensPerInterval, interval);
        socket.on("authenticate", data => {
          // We only limit password guessing
          if (data.strategy === "local") {
            debugLimiter(socket.authSocketLimiter.getTokensRemaining() + " remaining authentication token for socket", socket.id, socket.conn.remoteAddress);

            if (!socket.authSocketLimiter.tryRemoveTokens(1)) {
              // if exceeded
              tooManyRequests(socket, "Too many authentication requests in a given amount of time (rate limiting)", "RATE_LIMITING_AUTHENTICATION");
            }
          }
        });
      }
    });
  };
}

function emiGrup() {
  let app = (0, _express.default)((0, _feathers.default)()); // By default EventBatolyetters will print a warning if more than 10 listeners are added for a particular event.
  // The value can be set to Infinity (or 0) to indicate an unlimited number of listeners.

  app.setMaxListeners(0); // Load app configuration first

  app.configure((0, _configuration.default)()); // Then setup logger

  app.logger = setupLogger(app.get("logs")); // This avoid managing the API path before each service name

  app.getService = function (path, context) {
    // Context is given as string ID
    if (context && typeof context === "string") {
      return app.service(app.get("apiPath") + "/" + context + "/" + path);
    } else if (context && typeof context === "object") {
      // Could be Object ID or raw object
      if (_mongodb.ObjectID.isValid(context)) return app.service(app.get("apiPath") + "/" + context.toString() + "/" + path);else return app.service(app.get("apiPath") + "/" + context._id.toString() + "/" + path);
    } else {
      return app.service(app.get("apiPath") + "/" + path);
    }
  }; // This is used to add hooks/filters to services


  app.configureService = function (name, service, servicesPath) {
    return configureService(name, service, servicesPath);
  }; // This is used to create standard services


  app.createService = function (name, options) {
    return createService(name, app, options);
  }; // Override Feathers configure that do not manage async operations,
  // here we also simply call the function given as parameter but await for it


  app.configure = async function (fn) {
    await fn.call(this, this);
    return this;
  };

  const apiLimiter = app.get("apiLimiter");

  if (apiLimiter && apiLimiter.http) {
    app.use(app.get("apiPath"), new _expressRateLimit.default(apiLimiter.http));
  } // Enable CORS, security, compression, and body parsing


  app.use((0, _cors.default)());
  app.use((0, _helmet.default)());
  app.use((0, _compression.default)());
  app.use(_bodyParser.default.json());
  app.use(_bodyParser.default.urlencoded({
    extended: true
  })); // Set up plugins and providers

  app.configure((0, _rest.default)());
  app.configure((0, _socketio.default)({
    path: app.get("apiPath") + "ws"
  }, setupSockets(app)));
  app.configure(auth); // Initialize DB

  app.db = _db.Database.create(app);
  return app;
}