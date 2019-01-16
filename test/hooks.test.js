import chai from "chai";
import { hooks } from "../src";
import { ObjectID } from "mongodb";

describe("kCore:hooks", () => {
  before(() => {});

  it("sets expiry date", () => {
    let hook = { type: "before", data: {}, params: {} };
    hooks.setExpireAfter(7000)(hook);
    // Allow a difference of 1s due to execution time
    chai
      .expect(Math.abs(hook.data.expireAt.getTime() - Date.now() - 7000000))
      .to.be.below(1000);
  });

  it("sets as deleted", () => {
    let hook = { type: "before", data: {}, params: {} };
    hooks.setAsDeleted(hook);
    chai.expect(hook.data.deleted).to.be.true;
  });

  it("converts dates", () => {
    const now = new Date();
    let hook = {
      type: "before",
      data: { date: now.toISOString() },
      params: {}
    };
    hooks.convertDates(["date"])(hook);
    chai.expect(typeof hook.data.date).to.equal("object");
    chai.expect(hook.data.date.getTime()).to.equal(now.getTime());
  });

  it("converts object IDs", () => {
    const id = new ObjectID();
    let hook = {
      type: "before",
      data: { id: id.toString() },
      params: { query: { id: id.toString() } }
    };
    hooks.convertObjectIDs(["id"])(hook);
    chai.expect(typeof hook.data.id).to.equal("object");
    chai.expect(hook.data.id.toString()).to.equal(id.toString());
    chai.expect(typeof hook.params.query.id).to.equal("object");
    chai.expect(hook.params.query.id.toString()).to.equal(id.toString());
  });

  it("process object IDs", () => {
    const id = new ObjectID();
    let hook = {
      type: "before",
      data: { "field._id": id.toString() },
      params: { query: { _id: { $in: [id.toString()] } } }
    };
    hooks.processObjectIDs(hook);
    chai.expect(typeof hook.data["field._id"]).to.equal("object");
    chai.expect(hook.data["field._id"].toString()).to.equal(id.toString());
    chai.expect(typeof hook.params.query._id.$in[0]).to.equal("object");
    chai
      .expect(hook.params.query._id.$in[0].toString())
      .to.equal(id.toString());
  });

  it("marshalls comparison queries", () => {
    const now = new Date();
    let hook = {
      type: "before",
      params: {
        query: {
          number: { $gt: "0", $lt: "10" },
          date: { $gte: now.toISOString(), $lte: now.toISOString() }
        }
      }
    };
    hooks.marshallComparisonQuery(hook);
    chai.expect(typeof hook.params.query.number.$gt).to.equal("number");
    chai.expect(typeof hook.params.query.number.$lt).to.equal("number");
    chai.expect(hook.params.query.number.$gt).to.equal(0);
    chai.expect(hook.params.query.number.$lt).to.equal(10);
    chai.expect(typeof hook.params.query.date.$gte).to.equal("object");
    chai.expect(typeof hook.params.query.date.$lte).to.equal("object");
    chai.expect(hook.params.query.date.$gte.getTime()).to.equal(now.getTime());
    chai.expect(hook.params.query.date.$lte.getTime()).to.equal(now.getTime());
  });

  it("marshalls collation queries", () => {
    let hook = { type: "before", params: { query: { $locale: "tr" } } };
    hooks.marshallCollationQuery(hook);
    chai.expect(hook.params.collation).to.exist;
    chai.expect(hook.params.query.$locale).to.be.undefined;
    chai.expect(typeof hook.params.collation).to.equal("object");
    chai.expect(hook.params.collation.locale).to.equal("tr");
  });

  it("rate limiting", done => {
    const limiter = hooks.rateLimit({
      tokensPerInterval: 2,
      interval: 60 * 1000,
      method: "create",
      service: "service"
    }); // 2 per minute
    let hook = {
      type: "before",
      method: "create",
      data: {},
      params: {},
      service: { name: "service" }
    };
    try {
      limiter(hook);
      hook.n = 1;
      limiter(hook);
      hook.n = 2;
      // Should rise after 2 calls
      limiter(hook);
      hook.n = 3;
    } catch (error) {
      chai.expect(error).to.exist;
      chai.expect(error.name).to.equal("TooManyRequests");
      chai.expect(hook.n).to.equal(2);
      done();
    }
  });

  it("count limiting", done => {
    const limiter = hooks.countLimit({ count: hook => hook.n, max: 1 });
    let hook = {
      type: "before",
      method: "create",
      data: {},
      params: {},
      service: { name: "service" },
      n: 0
    };
    limiter(hook)
      .then(() => {
        hook.n = 1;
        return limiter(hook);
      })
      .then(() => {
        hook.n = 2;
        // Should rise after 2 calls
        return limiter(hook);
      })
      .catch(error => {
        chai.expect(error).to.exist;
        chai.expect(error.name).to.equal("Forbidden");
        chai.expect(hook.n).to.equal(2);
        done();
      });
  });

  // Cleanup
  after(async () => {});
});
