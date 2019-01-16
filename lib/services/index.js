"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createTagService = createTagService;
exports.removeTagService = removeTagService;
exports.createStorageService = createStorageService;
exports.removeStorageService = removeStorageService;
exports.default = _default;

var _path = _interopRequireDefault(require("path"));

var _debug = _interopRequireDefault(require("debug"));

var _multer = _interopRequireDefault(require("multer"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import aws from 'aws-sdk'
// import store from 's3-blob-store'
// import BlobService from 'feathers-blob'
const multipart = (0, _multer.default)().single("file");

const modelsPath = _path.default.join(__dirname, "..", "models");

const servicesPath = _path.default.join(__dirname, "..", "services");

const debug = (0, _debug.default)("emiGrup:eCore:services");

function createTagService(context, db) {
  const app = this;
  app.createService("tags", {
    servicesPath,
    modelsPath,
    context,
    db
  });
}

function removeTagService(context) {// TODO
}

function proxyStorageId(context) {
  return id => {
    if (!context) return id;
    const prefix = (typeof context === "object" ? context._id.toString() : context) + "/"; // Check if context is already in ID, in this case we have to remove it on output

    if (id.startsWith(prefix)) return id.replace(prefix, ""); // Otherwise we have to add it on input
    else return prefix + id;
  };
}

function createStorageService(blobService, context) {
  const app = this; // Closure to keep track of context

  const proxyId = proxyStorageId(context);
  app.createService("storage", {
    servicesPath,
    modelsPath,
    context,
    // Create a proxy on top of a Feathers blob service,
    // adding context as prefix on all keys on input
    // removing context as prefix on all keys as result
    proxy: {
      service: blobService,
      id: proxyId,
      data: data => data.id ? Object.assign(data, {
        id: proxyId(data.id)
      }) : data,
      result: data => data._id ? Object.assign(data, {
        _id: proxyId(data._id)
      }) : data
    },
    // Add required middlewares to handle multipart form data
    middlewares: {
      before: [multipart, (req, res, next) => {
        req.feathers.file = req.file;
        next();
      }]
    }
  });
}

function removeStorageService(context) {// TODO
}

async function _default() {
  const app = this;
  const storeConfig = app.get("storage");
  const authConfig = app.get("authentication");

  if (storeConfig) {// const client = new aws.S3({
    //   accessKeyId: storeConfig.accessKeyId,
    //   secretAccessKey: storeConfig.secretAccessKey
    // })
    // const bucket = storeConfig.bucket
    // debug('S3 core storage client created with config ', storeConfig)
    // const blobStore = store({ client, bucket })
    // const blobService = BlobService({ Model: blobStore, id: '_id' })
    // createStorageService.call(app, blobService)
  }

  if (authConfig) {
    app.createService("users", {
      modelsPath,
      servicesPath,
      // Add required OAuth2 provider perspectives
      perspectives: ["profile"].concat(app.authenticationProviders)
    });
    app.createService("authorisations", {
      servicesPath
    });
  } // We have a global tag/storage service and one by context if app requires it


  app.createService("tags", {
    modelsPath,
    servicesPath
  });
}