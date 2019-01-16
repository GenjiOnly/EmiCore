"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enforcePasswordPolicy = enforcePasswordPolicy;
exports.storePreviousPassword = storePreviousPassword;
exports.generatePassword = generatePassword;

var _lodash = _interopRequireDefault(require("lodash"));

var _passwordGenerator = _interopRequireDefault(require("password-generator"));

var _debug = _interopRequireDefault(require("debug"));

var _feathersHooksCommon = require("feathers-hooks-common");

var _errors = require("@feathersjs/errors");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('emiGrup:eCore:users:hooks');

function enforcePasswordPolicy(options = {}) {
  return async function (hook) {
    if (hook.type !== 'before') {
      throw new Error(`The 'enforePasswordPolicy' hook should only be used as a 'before' hook.`);
    } // By pass check ?


    if (hook.params.force) return hook;
    let app = hook.app;
    let item = (0, _feathersHooksCommon.getItems)(hook);
    let user = options.userAsItem ? item : hook.params.user; // Get both password(s) since some rules target one and some the other one(s)

    let clearPassword = _lodash.default.get(item, options.passwordField || 'clearPassword');

    let hashedPasswords = _lodash.default.get(user, options.previousPasswordsField || 'previousPasswords', []);

    if (clearPassword && hashedPasswords && app.getPasswordPolicy) {
      debug('Enforcing password policy on user', user);
      const validator = app.getPasswordPolicy(); // First check the clear password

      let result = validator.validate(clearPassword, {
        list: true
      }); // Then check for the last used passwords using password policy verifier

      for (let i = 0; i < hashedPasswords.length; i++) {
        try {
          await validator.comparePassword({
            password: hashedPasswords[i]
          }, clearPassword); // If we have found a similar password stop

          result.push('previous');
          break;
        } catch (error) {// Check next one
        }
      }

      if (!_lodash.default.isEmpty(result)) {
        throw new _errors.BadRequest('The provided password does not comply to the password policy', {
          translation: {
            key: 'WEAK_PASSWORD',
            keys: result.map(rule => 'WEAK_PASSWORD_' + rule.toUpperCase()),
            params: Object.assign({
              failedRules: result
            }, _lodash.default.omit(validator.options, ['prohibited']))
          }
        });
      }
    }

    return hook;
  };
}

function storePreviousPassword(options = {}) {
  return function (hook) {
    if (hook.type !== 'before') {
      throw new Error(`The 'storePreviousPassword' hook should only be used as a 'before' hook.`);
    }

    let app = hook.app;
    let data = (0, _feathersHooksCommon.getItems)(hook);

    if (app.getPasswordPolicy && hook.params.previousItem) {
      const validator = app.getPasswordPolicy(); // Based on previous password value

      let user = hook.params.previousItem;
      const passwordField = options.passwordField || 'password';

      let password = _lodash.default.get(user, passwordField);

      const previousPasswordsField = options.previousPasswordsField || 'previousPasswords';

      let previousPasswords = _lodash.default.get(user, previousPasswordsField, []);

      debug(`Moving previous password from field ${passwordField} in field ${previousPasswords} on user`, user);
      previousPasswords.push(password); // Pop oldest password when required

      const max = _lodash.default.get(validator, 'options.history', 5);

      if (previousPasswords.length > max) previousPasswords.shift();
      Object.assign(data, {
        [previousPasswordsField]: previousPasswords
      });
      (0, _feathersHooksCommon.replaceItems)(hook, data);
    }

    return hook;
  };
}

function generatePassword(hook) {
  if (hook.type !== 'before') {
    throw new Error(`The 'generatePassword' hook should only be used as a 'before' hook.`);
  }

  let app = hook.app;
  let data = hook.data; // Generate a password

  let passwordRule = new RegExp('[\\w\\d\\?\\-]'); // If we have a password policy ensure we match it

  if (app.getPasswordPolicy) {
    const validator = app.getPasswordPolicy();

    do {
      data.password = (0, _passwordGenerator.default)(validator.options.minLength || 12, false, passwordRule);
    } while (!validator.validate(data.password));
  } else {
    data.password = (0, _passwordGenerator.default)(12, false, passwordRule);
  }

  return hook;
}