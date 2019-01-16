"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.populateAttachmentResource = populateAttachmentResource;
exports.unpopulateAttachmentResource = unpopulateAttachmentResource;
exports.attachToResource = attachToResource;
exports.detachFromResource = detachFromResource;
exports.removeAttachments = removeAttachments;

var _lodash = _interopRequireDefault(require("lodash"));

var _hooks = require("./hooks.query");

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('emiGrup:eCore:storage:hooks');

function isAttachmentEqual(file1, file2) {
  return file1._id === file2._id;
}

function populateAttachmentResource(hook) {
  if (hook.type !== 'before') {
    throw new Error(`The 'populateStorageResource' hook should only be used as a 'before' hook.`);
  } // Avoid populating any target resource when resource parameters are not present


  return (0, _hooks.populateObject)({
    serviceField: 'resourcesService',
    idField: 'resource',
    throwOnNotFound: false
  })(hook);
}

function unpopulateAttachmentResource(hook) {
  if (hook.type !== 'after') {
    throw new Error(`The 'unpopulateAttachmentResource' hook should only be used as a 'after' hook.`);
  }

  return (0, _hooks.unpopulateObject)({
    serviceField: 'resourcesService',
    idField: 'resource'
  })(hook);
}

async function attachToResource(hook) {
  if (hook.type !== 'after') {
    throw new Error(`The 'attachToResource' hook should only be used as a 'after' hook.`);
  }

  const data = hook.data;
  const params = hook.params;
  const query = params.query;
  const file = hook.result;
  const attachmentField = _lodash.default.get(data, 'field') || _lodash.default.get(query, 'field') || 'attachments'; // By default attachments are stored in an array

  let isArray = _lodash.default.get(data, 'isArray') || _lodash.default.get(query, 'isArray') || true; // Take care that because file uploads might be submitted by external multipart form data middlewares
  // all parameters types might be string

  if (typeof isArray !== 'boolean') {
    isArray = isArray === 'true';
  }

  const context = hook.service.context;
  const resourcesService = params.resourcesService;
  let resource = params.resource;

  let attachments = _lodash.default.get(resource, attachmentField);

  let attachment = Object.assign({
    _id: file._id
  }, _lodash.default.omit(file, ['uri'])); // Add context because attachments might come from different ones on the same target object

  if (context) {
    attachment.context = typeof context === 'object' ? context._id : context;
  }

  if (isArray) {
    // Initialize on first attachment
    if (!attachments) attachments = [];
    attachments.push(attachment);
  } else {
    attachments = attachment;
  }

  await resourcesService.patch(resource._id.toString(), {
    [attachmentField]: attachments
  }, {
    user: params.user,
    // Forward query so that any update param could be processed as usual on resource
    // Delete own parameters from query otherwise it will be used to filter items
    query: _lodash.default.omit(query, ['resource', 'resourcesService'])
  });
  debug('Attached file on resource ' + resource._id.toString(), attachment);
  return hook;
}

async function detachFromResource(hook) {
  if (hook.type !== 'after') {
    throw new Error(`The 'detachFromResource' hook should only be used as a 'after' hook.`);
  }

  const params = hook.params;
  const query = params.query;
  let file = hook.result;
  const attachmentField = _lodash.default.get(query, 'field') || 'attachments';
  const resourcesService = params.resourcesService;
  let resource = params.resource;

  let attachments = _lodash.default.get(resource, attachmentField);

  let attachment; // List of attachments

  if (Array.isArray(attachments)) {
    const attachmentIndex = _lodash.default.findIndex(attachments, attachment => isAttachmentEqual(attachment, file));

    if (attachmentIndex >= 0) {
      // Keep track of it for logging
      attachment = attachments[attachmentIndex];

      _lodash.default.pullAt(attachments, attachmentIndex);
    }
  } else {
    // Single attachment object
    attachment = attachments;
    attachments = null;
  }

  await resourcesService.patch(resource._id.toString(), {
    [attachmentField]: attachments
  }, {
    user: params.user,
    // Forward query so that any update param could be processed as usual on resource
    // Delete own parameters from query otherwise it will be used to filter items
    query: _lodash.default.omit(query, ['resource', 'resourcesService'])
  });
  debug('Detached file on resource ' + resource._id.toString(), attachment);
  return hook;
}

function removeAttachments(attachmentField) {
  return async function (hook) {
    const context = hook.service.context;
    let storageService = hook.app.getService('storage', context);
    if (!storageService) return Promise.reject(new Error('No valid context found to retrieve storage service for initiator service ' + hook.service.name));
    let resource = hook.result;

    let attachments = _lodash.default.get(resource, attachmentField); // Process with each attachment


    if (attachments) {
      debug('Removing attachments for resource ' + resource._id.toString(), attachments);

      if (Array.isArray(attachments)) {
        let removePromises = [];
        attachments.forEach(attachment => {
          removePromises.push(storageService.remove(attachment._id)); // Thumbnail as well

          removePromises.push(storageService.remove(attachment._id + '.thumbnail'));
        });
        await Promise.all(removePromises);
      } else {
        await storageService.remove(attachments._id); // Thumbnail as well

        await storageService.remove(attachments._id + '.thumbnail');
      }
    }

    return hook;
  };
}