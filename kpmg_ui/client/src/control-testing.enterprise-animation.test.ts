import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

const controlTestingSource = read("client/src/pages/control-testing.tsx");
const howItWorksSource = read("client/src/components/HowItWorks.tsx");

assert.match(
  controlTestingSource,
  /\/audit\/start|auditUploadEvidence|generateWorkpaper/,
  "Control Testing redesign must keep the legacy audit context and API flow intact",
);

for (const marker of [
  "control-testing-experience",
  "control-testing-network-bg",
  "controlTestingHeaderGlow",
  "controlTestingParticleFloat",
  "control-testing-step-flow",
  "controlTestingPulseForward",
  "control-testing-upload-card",
]) {
  assert.match(controlTestingSource, new RegExp(marker), `Control Testing page should include ${marker}`);
}

assert.match(
  controlTestingSource,
  /<HowItWorks[\s\S]*?defaultOpen/,
  "Control Testing workflow should open by default to match the reference process layout",
);

assert.match(
  howItWorksSource,
  /how-it-works__step/,
  "HowItWorks should expose neutral step hooks for page-specific enterprise animations",
);
