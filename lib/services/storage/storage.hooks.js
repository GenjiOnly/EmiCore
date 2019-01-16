"use strict";

var _feathersHooksCommon = require("feathers-hooks-common");

var _hooks = require("../../hooks");

// import { getBase64DataURI } from 'dauria'
module.exports = {
  before: {
    all: [],
    find: [(0, _feathersHooksCommon.disallow)()],
    get: [],
    create: [_hooks.populateAttachmentResource, hook => {
      // If form multipart data transform to data buffer for blob service
      if (!hook.data.uri && hook.params.file) {
        // Before https://github.com/feathersjs-ecosystem/feathers-blob/releases/tag/v1.5.0 only data URI were supported
        // hook.data.uri = getBase64DataURI(hook.params.file.buffer, hook.params.file.mimetype)
        // Now raw buffers are
        hook.data.buffer = hook.params.file.buffer;
        hook.data.contentType = hook.params.file.mimetype;
      } // Makes uploaded files public when required


      if (hook.data.public) hook.params.s3 = {
        ACL: 'public-read'
      };
    }],
    update: [(0, _feathersHooksCommon.disallow)()],
    patch: [(0, _feathersHooksCommon.disallow)()],
    remove: [_hooks.populateAttachmentResource]
  },
  after: {
    all: [],
    find: [],
    get: [],
    // Let the attachment on the resource object occur only when resource has been found
    create: [hook => {
      // If form multipart data get filename
      if (hook.params.file) {
        hook.result.name = hook.params.file.originalname;
      }
    }, (0, _feathersHooksCommon.iff)(hook => hook.params.resource, _hooks.attachToResource), (0, _feathersHooksCommon.discard)('uri')],
    update: [],
    patch: [],
    // Let the detachment on the resource object occur only when resource has been found
    remove: [(0, _feathersHooksCommon.iff)(hook => hook.params.resource, _hooks.detachFromResource), (0, _feathersHooksCommon.discard)('uri')]
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