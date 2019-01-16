import path from "path";
import fs from "fs-extra";
// import { getBase64DataURI } from "dauria";
import request from "superagent";
import chai from "chai";
import core, { emiGrup } from "../src";

describe("kCore:storage", () => {
  let app,
    server,
    port,
    baseUrl,
    userService,
    userObject,
    storageService,
    storageObject;
  const content = Buffer.from("some buffered data");
  const contentType = "text/plain";
  const contentUri = getBase64DataURI(content, contentType);
  const id = "buffer.txt";
  const file = "logo.png";

  before(() => {
    app = emiGrup();
    port = app.get("port");
    baseUrl = `http://localhost:${port}${app.get("apiPath")}`;
    return app.db.connect();
  });

  it("registers the storage service", done => {
    app.configure(core);
    userService = app.getService("users");
    chai.expect(userService).to.exist;
    storageService = app.getService("storage");
    chai.expect(storageService).to.exist;
    // Now app is configured launch the server
    server = app.listen(port);
    server.once("listening", _ => done());
  });

  it("creates an object in storage", () => {
    return storageService.create({ id, uri: contentUri }).then(object => {
      storageObject = object;
      chai.expect(storageObject._id).to.equal(`${id}`);
      chai.expect(storageObject.size).to.equal(content.length);
    });
  })
    // Let enough time to process
    .timeout(10000);

  it("gets an object from storage", () => {
    return storageService.get(id).then(object => {
      storageObject = object;
      chai.expect(storageObject.uri).to.equal(contentUri);
      chai.expect(storageObject.size).to.equal(content.length);
    });
  })
    // Let enough time to process
    .timeout(5000);

  it("removes an object from storage", done => {
    storageService
      .remove(id)
      .then(object => {
        return storageService.get(id);
      })
      .catch(error => {
        chai.expect(error).to.exist;
        done();
      });
  })
    // Let enough time to process
    .timeout(5000);

  it("creates an object in storage using multipart form data", () => {
    const filePath = path.join(__dirname, "data", file);
    return request
      .post(`${baseUrl}/storage`)
      .field("id", file)
      .attach("file", filePath)
      .then(response => {
        storageObject = response.body;
        chai.expect(storageObject._id).to.equal(`${file}`);
        chai.expect(storageObject.size).to.equal(fs.statSync(filePath).size);
        return storageService.remove(file);
      });
  })
    // Let enough time to process
    .timeout(10000);

  it("creates an attachment on a resource", () => {
    return userService
      .create({
        email: "test@test.org",
        password: "Pass;word1",
        name: "test-user"
      })
      .then(user => {
        userObject = user;
        return storageService.create({
          id,
          uri: contentUri,
          resource: userObject._id.toString(),
          resourcesService: "users"
        });
      })
      .then(object => {
        storageObject = object;
        chai.expect(storageObject._id).to.equal(`${id}`);
        chai.expect(storageObject.size).to.equal(content.length);
        return userService.find({ query: { "profile.name": "test-user" } });
      })
      .then(users => {
        chai.expect(users.data.length > 0).to.be.true;
        userObject = users.data[0];
        chai.expect(userObject.attachments).to.exist;
        chai.expect(userObject.attachments.length > 0).to.be.true;
        chai.expect(userObject.attachments[0]._id).to.equal(storageObject._id);
      });
  })
    // Let enough time to process
    .timeout(10000);

  it("removes an attachment from a resource", () => {
    return storageService
      .remove(id, {
        query: {
          resource: userObject._id.toString(),
          resourcesService: "users"
        }
      })
      .then(object => {
        storageObject = object;
        chai.expect(storageObject._id).to.equal(`${id}`);
        return userService.find({ query: { "profile.name": "test-user" } });
      })
      .then(users => {
        chai.expect(users.data.length > 0).to.be.true;
        userObject = users.data[0];
        chai.expect(userObject.attachments).to.exist;
        chai.expect(userObject.attachments.length === 0).to.be.true;
        return userService.remove(userObject._id);
      });
  })
    // Let enough time to process
    .timeout(10000);

  // Cleanup
  after(async () => {
    if (server) await server.close();
    app.db.instance.dropDatabase();
  });
});
