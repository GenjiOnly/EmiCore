"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isTagEqual = isTagEqual;
exports.populateTagResource = populateTagResource;
exports.unpopulateTagResource = unpopulateTagResource;
exports.updateTags = updateTags;
exports.addTagIfNew = addTagIfNew;
exports.removeTagIfUnused = removeTagIfUnused;
exports.tagResource = tagResource;
exports.untagResource = untagResource;

var _lodash = _interopRequireDefault(require("lodash"));

var _errors = require("@feathersjs/errors");

var _feathersHooksCommon = require("feathers-hooks-common");

var _hooks = require("./hooks.query");

var _debug = _interopRequireDefault(require("debug"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const debug = (0, _debug.default)('emiGrup:eCore:tags:hooks');

function isTagEqual(tag1, tag2) {
  let equal = tag1.value === tag2.value && tag1.scope === tag2.scope; // when context is provided use it as well

  if (tag1.context && tag2.context) {
    equal = equal && tag1.context.toString() === tag2.context.toString();
  }

  return equal;
}

function populateTagResource(hook) {
  if (hook.type !== 'before') {
    throw new Error(`The 'populateTagResource' hook should only be used as a 'before' hook.`);
  } // Avoid populating any target resource when resource parameters are not present


  return (0, _hooks.populateObject)({
    serviceField: 'resourcesService',
    idField: 'resource',
    throwOnNotFound: false
  })(hook);
}

function unpopulateTagResource(hook) {
  if (hook.type !== 'after') {
    throw new Error(`The 'unpopulateTagResource' hook should only be used as a 'after' hook.`);
  } // Avoid populating any target resource when resource parameters are not present


  return (0, _hooks.unpopulateObject)({
    serviceField: 'resourcesService',
    idField: 'resource'
  })(hook);
}

async function updateTags(hook) {
  let item = (0, _feathersHooksCommon.getItems)(hook);

  if (!item.tags) {
    debug('No tags to update for object ', item);
    return Promise.resolve(hook);
  } // Tag service is contextual, look for context on initiator service


  const context = hook.service.context; // Retrieve previous version of the item

  let previousTags = _lodash.default.get(hook.params, 'previousItem.tags');

  if (previousTags) {
    // Find common tags
    const commonTags = _lodash.default.intersectionWith(item.tags, previousTags, isTagEqual); // Clear removed tags


    const removedTags = _lodash.default.differenceWith(previousTags, commonTags, isTagEqual);

    debug('Removing tags for object ', item, removedTags);
    const removePromises = removedTags.map(tag => {
      // When a contextual service is used we might not provide the context in tag, extract from service instead
      const tagService = hook.app.getService('tags', tag.context || context);
      if (!tagService) return Promise.reject(new Error('No valid context found to retrieve tag service for ', tag));else return tagService.remove(null, {
        query: tag
      });
    }); // And add new ones

    const addedTags = _lodash.default.differenceWith(item.tags, commonTags, isTagEqual);

    debug('Adding tags for object ', item, addedTags);
    const addedPromises = addedTags.map(tag => {
      // When a contextual service is used we might not provide the context in tag, extract from service instead
      const tagService = hook.app.getService('tags', tag.context || context);
      if (!tagService) return Promise.reject(new Error('No valid context found to retrieve tag service for ', tag));else return tagService.create(tag);
    });
    let [oldTags, newTags] = await Promise.all([Promise.all(removePromises), Promise.all(addedPromises)]);
    debug('Tags removed/added', oldTags, newTags); // Update tags to include information added when they are created (eg _id)
    // and add also context because tags might come from different ones on the same target object

    newTags = newTags.map(tag => {
      if (tag.context) return tag;else return Object.assign({
        context: typeof context === 'object' ? context._id : context
      }, tag);
    });
    item.tags = commonTags.concat(newTags);
  } else {
    if (hook.method !== 'remove') {
      // Add new tags
      debug('Adding tags for object ', item);
      const addPromises = item.tags.map(tag => {
        // When a contextual service is used we might not provide the context in tag, extract from service instead
        const tagService = hook.app.getService('tags', tag.context || context);
        if (!tagService) return Promise.reject(new Error('No valid context found to retrieve tag service for ', tag));else return tagService.create(tag);
      }); // Update tags to include information added when they are created (eg _id)

      let newTags = await Promise.all(addPromises); // and add also context because tags might come from different ones on the same target object

      newTags = newTags.map(tag => {
        if (tag.context) return tag;else return Object.assign({
          context: typeof context === 'object' ? context._id : context
        }, tag);
      });
      item.tags = newTags;
    } else {
      debug('Removing tags for object ', item);
      const removePromises = item.tags.map(tag => {
        // When a contextual service is used we might not provide the context in tag, extract from service instead
        const tagService = hook.app.getService('tags', tag.context || context);
        if (!tagService) return Promise.reject(new Error('No valid context found to retrieve tag service for ', tag));else return tagService.remove(null, {
          query: tag
        });
      });
      await Promise.all(removePromises);
    }
  } // Avoid transferring some internal data
  // item.tags = item.tags.map(tag => _.omit(tag, ['count']))


  return hook;
}

function addTagIfNew(hook) {
  if (hook.type !== 'before') {
    throw new Error(`The 'addTagIfNew' hook should only be used as a 'before' hook.`);
  }

  const tagService = hook.service;

  const value = _lodash.default.get(hook, 'data.value');

  const scope = _lodash.default.get(hook, 'data.scope');

  if (!value || !scope) {
    throw new _errors.BadRequest('Scope and value should be provided to create a tag');
  }

  return tagService.find({
    query: {
      value,
      scope
    }
  }).then(result => {
    // If it already exist avoid creating it in DB,
    // simply update counter and return it
    if (result.total > 0) {
      let tag = result.data[0];
      hook.result = tag;
      tag.count += 1;
      debug('Increasing tag ' + tag.value + ' count (' + tag.count + ') with scope ' + tag.scope);
      return tagService.patch(tag._id.toString(), {
        count: tag.count
      });
    } else {
      // Otherwise initialize tag counter
      hook.data.count = 1;
      return Promise.resolve(hook);
    }
  }).then(() => {
    return hook;
  });
}

function removeTagIfUnused(hook) {
  if (hook.type !== 'before') {
    throw new Error(`The 'removeTagIfUnused' hook should only be used as a 'before' hook.`);
  }

  const tagService = hook.service;

  const value = _lodash.default.get(hook.params, 'query.value');

  const scope = _lodash.default.get(hook.params, 'query.scope');

  if (!value || !scope) {
    throw new _errors.BadRequest('Scope and value should be provided to remove a tag');
  }

  return tagService.find({
    query: {
      value,
      scope
    }
  }).then(result => {
    // If it already exist decrease counter and erase it if not used anymore
    if (result.total > 0) {
      let tag = result.data[0];
      hook.result = tag;
      tag.count -= 1;

      if (tag.count <= 0) {
        debug('Removing unused tag ' + tag.value + ' with scope ' + tag.scope);
        return tagService.remove(tag._id.toString());
      } else {
        debug('Decreasing tag ' + tag.value + ' count (' + tag.count + ') with scope ' + tag.scope);
        return tagService.patch(tag._id.toString(), {
          count: tag.count
        });
      }
    } else {
      // Should not be possible, this will skip DB call
      hook.result = null;
      return Promise.resolve(hook);
    }
  }).then(() => {
    return hook;
  });
}

function tagResource(hook) {
  if (hook.type !== 'after') {
    throw new Error(`The 'tagResource' hook should only be used as a 'after' hook.`);
  }

  const tag = hook.result;
  const params = hook.params;
  const query = params.query;
  const context = hook.service.context;
  const resourcesService = params.resourcesService;
  let resource = params.resource; // If not already tagged

  if (!_lodash.default.find(resource.tags, resourceTag => isTagEqual(resourceTag, tag))) {
    // Initialize on first tag
    if (!resource.tags) {
      resource.tags = [];
    } // Add context because tags might come from different ones on the same target object


    if (context) {
      tag.context = typeof context === 'object' ? context._id : context;
    }

    resource.tags.push(tag);
    return resourcesService.patch(resource._id.toString(), {
      tags: resource.tags
    }, {
      user: hook.params.user,
      // Forward query so that any update param could be processed as usual on resource
      // Delete own parameters from query otherwise it will be used to filter items
      query: _lodash.default.omit(query, ['resource', 'resourcesService', 'scope', 'value', 'context'])
    }).then(subject => {
      debug('Tag ' + tag.value + ' set on resource ' + resource._id.toString() + ' with scope ' + tag.scope);
      return hook;
    });
  } else {
    return Promise.resolve(hook);
  }
}

function untagResource(hook) {
  if (hook.type !== 'after') {
    throw new Error(`The 'untagResource' hook should only be used as a 'after' hook.`);
  }

  const tag = hook.result;
  const params = hook.params;
  const query = params.query;
  const resourcesService = params.resourcesService;
  let resource = params.resource; // If already tagged

  const tagIndex = _lodash.default.findIndex(resource.tags, resourceTag => isTagEqual(resourceTag, tag));

  if (tagIndex >= 0) {
    _lodash.default.pullAt(resource.tags, tagIndex);

    return resourcesService.patch(resource._id.toString(), {
      tags: resource.tags
    }, {
      user: params.user,
      // Forward query so that any update param could be processed as usual on resource
      // Delete own parameters from query otherwise it will be used to filter items
      query: _lodash.default.omit(query, ['resource', 'resourcesService', 'scope', 'value', 'context'])
    }).then(subject => {
      debug('Tag ' + tag.value + ' unset on resource ' + resource._id.toString() + ' with scope ' + tag.scope);
      return hook;
    });
  } else {
    return Promise.resolve(hook);
  }
}