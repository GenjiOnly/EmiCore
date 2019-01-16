"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _debug = _interopRequireDefault(require("debug"));

var _lodash = _interopRequireDefault(require("lodash"));

var _authenticationOauth = require("@feathersjs/authentication-oauth2");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('feathers-authentication-oauth2:verify');

class OAuth2Verifier extends _authenticationOauth.Verifier {
  constructor(app, options = {}) {
    options.emailField = options.emailField || 'email';
    options.emailFieldInProfile = options.emailFieldInProfile || 'emails[0].value';
    super(app, options);
  }

  _updateEntity(entity, data) {
    const options = this.options;
    const name = options.name;
    const id = entity[this.service.id];
    debug(`Patching ${options.entity}: ${id}`);
    const newData = {
      [options.idField]: data.profile.id,
      [name]: data
    };
    return this.service.patch(id, newData);
  }

  verify(req, accessToken, refreshToken, profile, done) {
    debug('Checking credentials');
    const options = this.options;
    const query = {
      $or: [{
        [options.idField]: profile.id
      }, {
        [options.emailField]: _lodash.default.get(profile, options.emailFieldInProfile)
      }],
      $limit: 1
    };
    const data = {
      profile,
      accessToken,
      refreshToken
    };
    let existing; // Check request object for an existing entity

    if (req && req[options.entity]) {
      existing = req[options.entity];
    } // Check the request that came from a hook for an existing entity


    if (!existing && req && req.params && req.params[options.entity]) {
      existing = req.params[options.entity];
    } // If there is already an entity on the request object (ie. they are
    // already authenticated) attach the profile to the existing entity
    // because they are likely "linking" social accounts/profiles.


    if (existing) {
      return this._updateEntity(existing, data).then(entity => done(null, entity)).catch(error => error ? done(error) : done(null, error));
    } // Find or create the user since they could have signed up via facebook.


    this.service.find({
      query
    }).then(this._normalizeResult).then(entity => entity ? this._updateEntity(entity, data) : this._createEntity(data)).then(entity => {
      const id = entity[this.service.id];
      const payload = {
        [`${this.options.entity}Id`]: id
      };
      done(null, entity, payload);
    }).catch(error => error ? done(error) : done(null, error));
  }

}

var _default = OAuth2Verifier;
exports.default = _default;