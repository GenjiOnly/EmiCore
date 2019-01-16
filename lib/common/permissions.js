"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defineResourceRules = defineResourceRules;
exports.defineUserAbilities = defineUserAbilities;
exports.defineAbilities = defineAbilities;
exports.hasServiceAbilities = hasServiceAbilities;
exports.hasResourceAbilities = hasResourceAbilities;
exports.removeContext = removeContext;
exports.getQueryForAbilities = getQueryForAbilities;
exports.findSubjectsForResource = findSubjectsForResource;
exports.countSubjectsForResource = countSubjectsForResource;
exports.RESOURCE_TYPE_KEY = exports.RESOURCE_TYPE = exports.RoleNames = exports.Roles = void 0;

var _lodash = _interopRequireDefault(require("lodash"));

var _umd = require("casl/dist/umd");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Define some alias to simplify ability definitions
_umd.Ability.addAlias("update", "patch");

_umd.Ability.addAlias("read", ["get", "find"]);

_umd.Ability.addAlias("remove", "delete");

_umd.Ability.addAlias("all", ["read", "create", "update", "remove"]);

const Roles = {
  member: 0,
  manager: 1,
  owner: 2
};
exports.Roles = Roles;
const RoleNames = ["member", "manager", "owner"]; // Hooks that can be added to customize abilities computation

exports.RoleNames = RoleNames;
let hooks = []; // Get the unique global symbol to store resource type / context on a resource object

const RESOURCE_TYPE = "type";
exports.RESOURCE_TYPE = RESOURCE_TYPE;
const RESOURCE_TYPE_KEY = Symbol.for(RESOURCE_TYPE);
exports.RESOURCE_TYPE_KEY = RESOURCE_TYPE_KEY;

function defineResourceRules(subject, resource, resourceService, can) {
  const role = Roles[resource.permissions];

  if (role >= Roles.member) {
    can("read", resourceService, {
      _id: resource._id
    });
  }

  if (role >= Roles.manager) {
    can("update", resourceService, {
      _id: resource._id
    });
    can(["create", "remove"], "authorisations", {
      resource: resource._id
    });
  }

  if (role >= Roles.owner) {
    can("remove", resourceService, {
      _id: resource._id
    });
  }
} // Hook computing default abilities for a given user


function defineUserAbilities(subject, can, cannot) {
  // Register
  can("service", "users");
  can("create", "users");

  if (subject && subject._id) {
    // Read user profiles for authorizing
    can("read", "users"); // Update user profile and destroy it

    can(["update", "remove"], "users", {
      _id: subject._id
    }); // Access authorisation service, then rights will be granted on a per-resource basis

    can("service", "authorisations"); // Access storage service, then rights will be granted on a per-resource basis

    can("service", "storage"); // This is for the user avatar
    // take care that the storage service uses 'id' as input but produces _id as output

    can("create", "storage", {
      id: "avatars/" + subject._id.toString()
    });
    can("create", "storage", {
      id: "avatars/" + subject._id.toString() + ".thumbnail"
    });
    can(["read", "remove"], "storage", {
      _id: "avatars/" + subject._id.toString()
    });
    can(["read", "remove"], "storage", {
      _id: "avatars/" + subject._id.toString() + ".thumbnail"
    });
  }
} // Compute abilities for a given user


function defineAbilities(subject) {
  const {
    rules,
    can,
    cannot
  } = _umd.AbilityBuilder.extract(); // Run registered hooks


  hooks.forEach(hook => hook(subject, can, cannot)); // CASL cannot infer the object type from the object itself so we need
  // to tell it how he can find the object type, i.e. service name.

  return new _umd.Ability(rules, {
    subjectName: resource => {
      if (!resource || typeof resource === "string") {
        return resource;
      }

      return resource[RESOURCE_TYPE_KEY];
    }
  });
}

defineAbilities.registerHook = function (hook) {
  if (!hooks.includes(hook)) {
    hooks.push(hook);
  }
};

defineAbilities.unregisterHook = function (hook) {
  hooks = hooks.filter(registeredHook => registeredHook !== hook);
};

function hasServiceAbilities(abilities, service) {
  if (!abilities) return false; // The unique identifier of a service is its path not its name.
  // Indeed we have for instance a 'groups' service in each organisation
  // Take care that in client we have the service path while on server we have the actual object

  const path = typeof service === "string" ? service : service.getPath();
  return abilities.can("service", path);
}

function hasResourceAbilities(abilities, operation, resourceType, context, resource) {
  if (!abilities) return false; // Create a shallow copy adding context and type

  let object = Object.assign({}, resource);
  object[RESOURCE_TYPE_KEY] = resourceType; // Add a virtual context to take it into account for object having no link to it

  if (context) object.context = typeof context === "object" ? context._id.toString() : context;
  const result = abilities.can(operation, object);
  return result;
} // Utility function used to remove the virtual context from query


function removeContext(query) {
  _lodash.default.forOwn(query, (value, key) => {
    // Process current attributes or recurse
    // Take care to nested fields like 'field._id'
    if (key === "context") {
      delete query.context;
    } else if (Array.isArray(value)) {
      value.forEach(item => removeContext(item)); // Remove empty objects from array

      _lodash.default.remove(value, item => _lodash.default.isEmpty(item)); // Remove empty arrays from query


      if (_lodash.default.isEmpty(value)) delete query[key];
    } else if (typeof value === "object") {
      removeContext(value); // Remove empty objects from query

      if (_lodash.default.isEmpty(value)) delete query[key];
    }
  });

  return query;
} // Get the query used to filter the objects according to given abilities
// A null query indicates that access should not be granted


function getQueryForAbilities(abilities, operation, resourceType) {
  if (!abilities) return null;
  const rules = abilities.rulesFor(operation, resourceType);
  let query = (0, _umd.toMongoQuery)(rules); // Remove any context to avoid taking it into account because it is not really stored on objects

  return query ? removeContext(query) : null;
}

function buildSubjectsQueryForResource(resourceScope, resourceId, role) {
  let query = {
    [resourceScope + "._id"]: resourceId
  };

  if (role) {
    Object.assign(query, {
      [resourceScope + ".permissions"]: RoleNames[role]
    });
  }

  return query;
}

function findSubjectsForResource(subjectService, resourceScope, resourceId, role) {
  // Build the query
  let query = buildSubjectsQueryForResource(resourceScope, resourceId, role); // Execute the query

  return subjectService.find({
    query
  });
}

function countSubjectsForResource(subjectService, resourceScope, resourceId, role) {
  // Build the query
  let query = buildSubjectsQueryForResource(resourceScope, resourceId, role); // Indicate we'd only like to count

  query.$limit = 0; // Execute the query

  return subjectService.find({
    query
  });
}