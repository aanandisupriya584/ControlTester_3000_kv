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
