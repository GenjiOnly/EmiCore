"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.populateSubjects = populateSubjects;
exports.unpopulateSubjects = unpopulateSubjects;
exports.populateResource = populateResource;
exports.unpopulateResource = unpopulateResource;
exports.preventEscalation = preventEscalation;
exports.authorise = authorise;
exports.updateAbilities = updateAbilities;

var _lodash = _interopRequireDefault(require("lodash"));

var _feathersHooksCommon = require("feathers-hooks-common");

var _errors = require("@feathersjs/errors");

var _hooks = require("./hooks.query");

var _mongoDb = require("../common/utils/mongoDb");

var _permissions = require("../common/permissions");

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)("emiGrup:eCore:authorisations:hooks");

function populateSubjects(hook) {
  if (hook.type !== "before") {
    throw new Error(`The 'populateSubjects' hook should only be used as a 'before' hook.`);
  }

  return (0, _hooks.populateObjects)({
    serviceField: "subjectsService",
    idField: "subjects",
    throwOnNotFound: true
  })(hook);
}

function unpopulateSubjects(hook) {
  if (hook.type !== "after") {
    throw new Error(`The 'unpopulateSubjects' hook should only be used as a 'after' hook.`);
  }

  return (0, _hooks.unpopulateObjects)({
    serviceField: "subjectsService",
    idField: "subjects"
  })(hook);
}

function populateResource(hook) {
  if (hook.type !== "before") {
    throw new Error(`The 'populateResource' hook should only be used as a 'before' hook.`);
  }

  return (0, _hooks.populateObject)({
    serviceField: "resourcesService",
    idField: "resource",
    throwOnNotFound: true
  })(hook);
}

function unpopulateResource(hook) {
  if (hook.type !== "after") {
    throw new Error(`The 'unpopulateResource' hook should only be used as a 'after' hook.`);
  }

  return (0, _hooks.unpopulateObject)({
    serviceField: "resourcesService",
    idField: "resource"
  })(hook);
}

function preventEscalation(hook) {
  if (hook.type !== "before") {
    throw new Error(`The 'preventEscalation' hook should only be used as a 'before' hook.`);
  }

  let params = hook.params; // If called internally we skip authorisation

  let checkEscalation = params.hasOwnProperty("provider");
  debug("Escalation check " + (checkEscalation ? "enabled" : "disabled") + " for provider"); // If explicitely asked to perform/skip, override defaults

  if (params.hasOwnProperty("checkEscalation")) {
    checkEscalation = params.checkEscalation;
    debug("Escalation check " + (checkEscalation ? "forced" : "unforced"));
  }

  if (checkEscalation) {
    const user = params.user; // Make hook usable on remove as well

    let data = hook.data || {}; // Make hook usable with query params as well

    let query = params.query || {};
    let scopeName = data.scope || query.scope; // Get scope name first
    // Retrieve the right scope on the user

    let scope = _lodash.default.get(user, scopeName, []); // Then the target resource


    let resource = _lodash.default.find(scope, resource => resource._id && resource._id.toString() === params.resource._id.toString()); // Then user permission level


    const permissions = resource ? resource.permissions : undefined;
    const role = permissions ? _permissions.Roles[permissions] : undefined;

    if (_lodash.default.isUndefined(role)) {
      debug("Role for authorisation not found on user for scope " + scopeName);
      throw new _errors.Forbidden(`You are not allowed to change authorisation on resource`);
    } // Check if privilege escalation might occur, if so clamp to user permission level
    // Input subjects need to be checked:
    // - on create you should not be able to change permissions on others having higher permissions than yourself
    // (e.g. cannot change a owner into a manager when you are a manager)
    // - on remove you should not be able to remove permissions on others having higher permissions than yourself
    // (e.g. cannot remove a owner when you are a manager)


    const subjects = params.subjects.filter(subject => {
      const subjectScope = _lodash.default.get(subject, scopeName, []);

      const subjectResource = _lodash.default.find(subjectScope, resource => resource._id && resource._id.toString() === params.resource._id.toString());

      const subjectPermissions = subjectResource ? subjectResource.permissions : undefined;
      const subjectRole = subjectPermissions ? _permissions.Roles[subjectPermissions] : undefined;
      const hasRole = !_lodash.default.isUndefined(subjectRole);

      if (hook.method === "create") {
        return !hasRole || subjectRole <= role; // The first time no authorisation can be found
      } else {
        return hasRole && subjectRole <= role; // Authorisation must be found on remove
      }
    });

    if (subjects.length < params.subjects.length) {
      debug(`${params.subjects.length - subjects.length} subjects with higher permissions level found for scope ${scopeName}`);
      throw new _errors.Forbidden(`You are not allowed to change authorisation on subject(s)`);
    } // Input permissions needs to be checked since:
    // - you should not be able to give higher permissions than your own ones to others
    // (e.g. cannot create a owner when you are a manager)


    let authorisationRole;

    if (data.permissions) {
      authorisationRole = _permissions.Roles[data.permissions];
    } else if (query.permissions) {
      authorisationRole = _permissions.Roles[query.permissions];
    }

    if (!_lodash.default.isUndefined(authorisationRole)) {
      if (authorisationRole > role) {
        debug("Cannot escalate with higher permissions level for scope " + scopeName);
        throw new _errors.Forbidden(`You are not allowed to change authorisation on resource`);
      }
    }
  }

  return hook;
}

function authorise(hook) {
  if (hook.type !== "before") {
    throw new Error(`The 'authorise' hook should only be used as a 'before' hook.`);
  }

  const operation = hook.method;
  const resourceType = hook.service.name;
  debug("Provider is", hook.params.provider);
  if (hook.params.user) debug("User is", hook.params.user);
  debug("Operation is", operation);
  if (resourceType) debug("Resource type is", resourceType); // If called internally we skip authorisation

  let checkAuthorisation = hook.params.hasOwnProperty("provider");
  debug("Access check " + (checkAuthorisation ? "enabled" : "disabled") + " for provider"); // If already checked we skip authorisation

  if (hook.params.authorised) {
    debug("Access already granted");
    checkAuthorisation = false;
  } // We also skip authorisation for built-in Feathers services like authentication


  if (typeof hook.service.getPath !== "function") {
    debug("Access disabled on built-in services");
    checkAuthorisation = false;
  } // If explicitely asked to perform/skip, override defaults


  if (hook.params.hasOwnProperty("checkAuthorisation")) {
    checkAuthorisation = hook.params.checkAuthorisation; // Bypass authorisation for next hooks otherwise we will loop infinitely

    delete hook.params.checkAuthorisation;
    debug("Access check " + (checkAuthorisation ? "forced" : "unforced"));
  }

  const context = hook.service.context;

  if (checkAuthorisation) {
    // Build ability for user
    let authorisationService = hook.app.getService("authorisations");
    const abilities = authorisationService.getAbilities(hook.params.user);
    hook.params.abilities = abilities;
    debug("User abilities are", abilities.rules); // Check for access to service fisrt

    if (!(0, _permissions.hasServiceAbilities)(abilities, hook.service)) {
      debug("Service access not granted");
      throw new _errors.Forbidden(`You are not allowed to access service ${hook.service.getPath()}`);
    }

    if (!hook.id) {
      // In this specific case there is no query to be run,
      // simply check against the object we'd like to create
      if (operation === "create") {
        let resource = hook.data;
        debug("Target resource is ", resource);

        if (!(0, _permissions.hasResourceAbilities)(abilities, operation, resourceType, context, resource)) {
          debug("Resource access not granted");
          throw new _errors.Forbidden(`You are not allowed to perform ${operation} operation on ${resourceType}`);
        }
      } else {
        // When we find/update/patch/remove multiple items this ensures that
        // only the ones authorised by constraints on the resources will be fetched
        // This avoid fetching all first then check it one by one
        const dbQuery = (0, _mongoDb.objectifyIDs)((0, _permissions.getQueryForAbilities)(abilities, operation, resourceType));

        if (dbQuery) {
          debug("Target resource conditions are ", dbQuery);

          _lodash.default.merge(hook.params.query, dbQuery);
        } else {
          hook.result = {
            total: 0,
            skip: 0,
            data: []
          };
        }
      }

      debug("Resource access granted"); // Some specific services might not expose a get function, in this case we cannot check for authorisation
      // this has to be implemented by the service itself
    } else if (typeof hook.service.get === "function") {
      // In this case (single get/update/patch/remove) we need to fetch the item first
      return hook.service.get(hook.id, Object.assign({
        checkAuthorisation: false
      }, hook.params)).then(resource => {
        debug("Target resource is", resource); // Then check against the object we'd like to manage

        if (!(0, _permissions.hasResourceAbilities)(abilities, operation, resourceType, context, resource)) {
          debug("Resource access not granted");
          throw new _errors.Forbidden(`You are not allowed to perform ${operation} operation on ${resourceType}`);
        } // Avoid fetching again the object in this case


        if (operation === "get") {
          hook.result = resource;
        }

        hook.params.authorised = true;
        debug("Resource access granted");
        return hook;
      });
    }
  } else {
    debug("Authorisation check skipped, access granted");
  }

  hook.params.authorised = true;
  return Promise.resolve(hook);
}

function updateAbilities(options = {}) {
  return async function (hook) {
    let app = hook.app;
    let params = hook.params;
    let authorisationService = app.getService("authorisations");
    let subject = options.subjectAsItem ? (0, _feathersHooksCommon.getItems)(hook) : params.user; // We might not have all information required eg on patch to compute new abilities,
    // in this case we have to fetch the whole subject

    if (options.fetchSubject) {
      subject = await hook.service.get(subject._id.toString());
    }

    const abilities = authorisationService.updateAbilities(subject);
    debug("Abilities updated on subject", subject, abilities.rules);
    return hook;
  };
}