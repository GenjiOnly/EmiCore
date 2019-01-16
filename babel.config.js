const presets = [
  [
    "@babel/preset-env",
    {
      targets: {
        node: "current"
      }
    }
  ]
];
const plugins = [
  "@babel/plugin-proposal-export-namespace-from",
  "@babel/plugin-proposal-export-default-from"
];

if (process.env["ENV"] === "prod") {
  plugins.push();
}

module.exports = { presets, plugins };
