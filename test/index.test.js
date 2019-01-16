import path from "path";
import logger from "winston";
import fs from "fs-extra";
import request from "superagent";
import chai from "chai";
import init, { emiGrup, hooks, permissions } from "../src";
const { hashPassword } = require("@feathersjs/authentication-local").hooks;

describe("kCore", () => {
  let app,
    server,
    port,
    baseUrl,
    accessToken,
    userService,
    userObject,
    authorisationService,
    tagService,
    tagObject;

  before(() => {
    // Register default rules for all users
    permissions.defineAbilities.registerHook(permissions.defineUserAbilities);

    app = emiGrup();
    // Register perspective hook
    app.hooks({
      before: { all: hooks.authorise },
      after: { all: hooks.processPerspectives },
      error: { all: hooks.log }
    });
    port = app.get("port");
    baseUrl = `http://localhost:${port}${app.get("apiPath")}`;
    return app.db.connect();
  });

  it("is CommonJS compatible", () => {
    chai.expect(typeof init).to.equal("function");
  });

  it("registers the services", done => {
    app.configure(init);
    userService = app.getService("users");
    chai.expect(userService).to.exist;
    // Register tag hooks
    userService.hooks({
      after: { create: hooks.updateTags, remove: hooks.updateTags }
    });
    tagService = app.getService("tags");
    chai.expect(tagService).to.exist;
    authorisationService = app.getService("authorisations");
    chai.expect(authorisationService).to.exist;
    // Register escalation hooks
    authorisationService.hooks({
      before: {
        create: hooks.preventEscalation,
        remove: hooks.preventEscalation
      }
    });
    // Now app is configured launch the server
    server = app.listen(port);
    server.once("listening", _ => done());
  });

  it("unauthenticated user cannot access services", done => {
    tagService.create({}, { checkAuthorisation: true }).catch(error => {
      chai.expect(error).to.exist;
      chai.expect(error.name).to.equal("Forbidden");
      done();
    });
  });

  it("cannot create a user with a weak password", done => {
    // Fake password hashing on a user to get a hashed password
    hashPassword()({
      type: "before",
      data: { password: "weak;" },
      params: {},
      app
    }).then(hook => {
      userService
        .create({
          email: "test@test.org",
          password: "weak;",
          previousPasswords: [hook.data.password],
          name: "test-user"
        })
        .catch(error => {
          chai.expect(error).to.exist;
          chai.expect(error.name).to.equal("BadRequest");
          chai
            .expect(error.data.translation.params.failedRules)
            .to.deep.equal(["min", "uppercase", "digits", "previous"]);
          userService
            .create({
              email: "test@test.org",
              password: "12345678",
              name: "test-user"
            })
            .catch(error => {
              chai.expect(error).to.exist;
              chai.expect(error.name).to.equal("BadRequest");
              chai
                .expect(error.data.translation.params.failedRules)
                .to.deep.equal(["uppercase", "lowercase", "symbols", "oneOf"]);
              done();
            });
        });
    });
  })
    // Let enough time to process
    .timeout(5000);

  it("creates a user", () => {
    // Test password generation
    let hook = hooks.generatePassword({
      type: "before",
      data: {},
      params: {},
      app
    });
    return userService
      .create(
        {
          email: "test@test.org",
          password: hook.data.password,
          name: "test-user",
          tags: [
            {
              scope: "skills",
              value: "developer"
            }
          ],
          profile: { phone: "0623256968" }
        },
        { checkAuthorisation: true }
      )
      .then(user => {
        userObject = user;
        // Keep track of clear password
        userObject.clearPassword = hook.data.password;
        return userService.find({ query: { "profile.name": "test-user" } });
      })
      .then(users => {
        chai.expect(users.data.length > 0).to.be.true;
        // By default no perspective
        chai.expect(users.data[0].name).to.exist;
        chai.expect(users.data[0].description).to.exist;
        chai.expect(users.data[0].email).to.exist;
        chai.expect(users.data[0].clearPassword).to.be.undefined;
        chai.expect(users.data[0].profile).to.be.undefined;
        return tagService.find({ query: { value: "developer" } });
      })
      .then(tags => {
        chai.expect(tags.data.length > 0).to.be.true;
        chai.expect(tags.data[0].value).to.equal("developer");
        chai.expect(tags.data[0].scope).to.equal("skills");
      });
  });

  it("changing user password keeps password history", () => {
    return userService
      .patch(userObject._id.toString(), { password: userObject.password })
      .then(() => {
        return userService.get(userObject._id.toString());
      })
      .then(user => {
        chai.expect(user.previousPasswords).to.exist;
        chai
          .expect(user.previousPasswords)
          .to.deep.equal([userObject.password]);
      })
  });

  it("authenticates a user", () => {
    return request
      .post(`${baseUrl}/authentication`)
      .send({
        email: "test@test.org",
        password: userObject.clearPassword,
        strategy: "local"
      })
      .then(response => {
        accessToken = response.body.accessToken;
        chai.expect(accessToken).to.exist;
      });
  });

  it("authenticated user can access services", () => {
    return userService
      .find({
        query: {},
        params: { user: userObject, checkAuthorisation: true }
      })
      .then(users => {
        chai.expect(users.data.length === 1).to.be.true;
      });
  });

  it("get a user perspective", () => {
    return userService.find({ query: { $select: ["profile"] } }).then(users => {
      chai.expect(users.data[0].profile.name).to.exist;
      chai.expect(users.data[0].profile.description).to.exist;
      chai.expect(users.data[0].profile.phone).to.exist;
    });
  });

  it("creates a user tag", () => {
    return tagService
      .create(
        {
          scope: "skills",
          value: "manager"
        },
        {
          query: {
            resource: userObject._id.toString(),
            resourcesService: "users"
          }
        }
      )
      .then(tag => {
        tagObject = tag;
        chai.expect(tag).to.exist;
        chai.expect(tag.count).to.equal(1);
        return tagService.find({ query: { value: "manager" } });
      })
      .then(tags => {
        chai.expect(tags.data.length > 0).to.be.true;
        chai.expect(tags.data[0].scope).to.equal("skills");
        return userService.find({ query: { "profile.name": "test-user" } });
      })
      .then(users => {
        chai.expect(users.data.length > 0).to.be.true;
        userObject = users.data[0];
        chai.expect(userObject.tags).to.exist;
        chai.expect(userObject.tags.length === 2).to.be.true;
        chai.expect(userObject.tags[1]._id).to.exist;
      });
  });

  it("creates an authorisation", () => {
    return authorisationService
      .create(
        {
          scope: "authorisations",
          permissions: "manager",
          subjects: userObject._id.toString(),
          subjectsService: "users",
          resource: tagObject._id.toString(),
          resourcesService: "tags"
        },
        {
          user: userObject
        }
      )
      .then(authorisation => {
        chai.expect(authorisation).to.exist;
        return userService.get(userObject._id.toString());
      })
      .then(user => {
        userObject = user;
        chai.expect(user.authorisations).to.exist;
        chai.expect(user.authorisations.length > 0).to.be.true;
        chai
          .expect(user.authorisations[0].permissions)
          .to.deep.equal("manager");
      });
  });

  it("cannot escalate an authorisation when creating", done => {
    authorisationService
      .create(
        {
          scope: "authorisations",
          permissions: "owner",
          subjects: userObject._id.toString(),
          subjectsService: "users",
          resource: tagObject._id.toString(),
          resourcesService: "tags"
        },
        {
          user: userObject,
          checkEscalation: true
        }
      )
      .catch(error => {
        chai.expect(error).to.exist;
        chai.expect(error.name).to.equal("Forbidden");
        done();
      });
  });

  it("cannot escalate an authorisation when removing", done => {
    // Fake lower permission level
    userObject.authorisations[0].permissions = "member";
    authorisationService
      .remove(tagObject._id, {
        query: {
          scope: "authorisations",
          subjects: userObject._id.toString(),
          subjectsService: "users",
          resourcesService: "tags"
        },
        user: userObject,
        checkEscalation: true
      })
      .catch(error => {
        chai.expect(error).to.exist;
        chai.expect(error.name).to.equal("Forbidden");
        // Restore permission level
        userObject.authorisations[0].permissions = "manager";
        done();
      });
  });

  it("removes an authorisation", () => {
    return authorisationService
      .remove(tagObject._id, {
        query: {
          scope: "authorisations",
          subjects: userObject._id.toString(),
          subjectsService: "users",
          resourcesService: "tags"
        },
        user: userObject,
        checkEscalation: true
      })
      .then(authorisation => {
        chai.expect(authorisation).to.exist;
        return userService.get(userObject._id.toString());
      })
      .then(user => {
        chai.expect(user.authorisations).to.exist;
        chai.expect(user.authorisations.length === 0).to.be.true;
      });
  });

  it("removes a user tag", () => {
    return tagService
      .remove(userObject._id, {
        query: {
          scope: "skills",
          value: "manager",
          resourcesService: "users"
        }
      })
      .then(tag => {
        chai.expect(tag).to.exist;
        return tagService.find({ query: { value: "manager" } });
      })
      .then(tags => {
        chai.expect(tags.data.length === 0).to.be.true;
        return tagService.find({ query: { value: "developer" } });
      })
      .then(tags => {
        chai.expect(tags.data.length === 1).to.be.true;
        return userService.find({ query: { "profile.name": "test-user" } });
      })
      .then(users => {
        chai.expect(users.data.length > 0).to.be.true;
        chai.expect(users.data[0].tags.length === 1).to.be.true;
      });
  });

  it("unauthenticates a user", () => {
    return request
      .del(`${baseUrl}/authentication`)
      .set("Content-Type", "application/json")
      .set("Authorization", accessToken)
      .then(response => {
        chai.expect(response.status).to.equal(200);
      });
  });

  it("removes a user", () => {
    return userService
      .remove(userObject._id, {
        user: userObject,
        checkAuthorisation: true
      })
      .then(user => {
        return userService.find({ query: { name: "test-user" } });
      })
      .then(users => {
        chai.expect(users.data.length === 0).to.be.true;
        return tagService.find({ query: { value: "developer" } });
      })
      .then(tags => {
        chai.expect(tags.data.length === 0).to.be.true;
      });
  });

  it("registers the log options", done => {
    // Inserted manually
    let log = "This is a log test";
    // Raised by Forbidden error in hooks
    let hookLog = "You are not allowed to access service";
    let now = new Date();
    app.logger.info(log);
    // FIXME: need to let some time to proceed with log file
    // Didn't find a better way since fs.watch() does not seem to work...
    setTimeout(() => {
      let logFilePath = path.join(
        __dirname,
        "test-log-" + now.toISOString().slice(0, 10) + ".log"
      );
      fs.readFile(logFilePath, "utf8", (err, content) => {
        chai.expect(err).to.be.null;
        chai.expect(content.includes(log)).to.be.true;
        // chai.expect(content.includes(hookLog)).to.be.false;
        done();
      });
    }, 2500);
  })
    // Let enough time to process
    .timeout(15000);

  // Cleanup
  after(async () => {
    if (server) await server.close();
    app.db.instance.dropDatabase();
  });
});
