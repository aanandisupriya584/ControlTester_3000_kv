import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("client/src/App.tsx"), "utf8");

assert.match(
  source,
  /key=\{workspaceKey\}/,
  "The global provider tree should reset page and workspace state when the normalized route changes",
);

assert.match(
  source,
  /location\.split\(\/\[\?#\]\/,\s*1\)/,
  "Query-string workflow changes should not reset the active detail workspace",
);

assert.match(
  source,
  /PAGES\.find\(\(\{ path \}\) => path === workspaceKeyFromLocation\(location\)\)/,
  "The router should resolve one active base page from the current URL",
);

assert.doesNotMatch(
  source,
  /PAGES\.map\(/,
  "Inactive workspaces should not remain mounted with stale page state",
);
