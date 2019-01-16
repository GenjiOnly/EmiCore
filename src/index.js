import makeDebug from "debug";
import services from "./services";
// We faced a bug in babel so that transform-runtime with export * from 'x' generates import statements in transpiled code
// Tracked here : https://github.com/babel/babel/issues/2877
// We tested the workaround given here https://github.com/babel/babel/issues/2877#issuecomment-270700000 with success so far

import * as hooks from './hooks'
export { hooks };

export * from "./services";
export * from "./db";
export * from "./application";
export * from "./common/utils/marshall";
export * from "./common/utils/mongoDb";
export * from "./common";

const debug = makeDebug("emiGrup:eCore");

export default function init() {
  const app = this;

  debug("Initializing emiGrup");

  app.configure(services);
}
