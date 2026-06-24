import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

const source = read("client/src/pages/risk-assessment.tsx");
const appSource = read("client/src/App.tsx");
const contextSource = read("client/src/contexts/RiskAssessmentContext.tsx");
const ciaWidgetSource = read("client/src/components/CiaRatingWidget.tsx");
const questionnaireSource = read("client/src/pages/RiskAssessment/components/workflow/QuestionnaireForm.tsx");
const applyControlsSource = read("client/src/pages/RiskAssessment/components/workflow/ApplyControlToRiskPage.tsx");
const reportSource = read("client/src/pages/RiskAssessment/components/workflow/RiskAssessmentReport.tsx");

assert.doesNotMatch(
  source,
  /<<<<<<<|=======|>>>>>>>/,
  "Risk Assessment source should not contain merge conflict markers",
);

for (const hook of ["useRiskAssessment", "useAssetRegistry", "useToast"]) {
  assert.match(
    source,
    new RegExp(hook),
    `Risk Assessment should preserve existing ${hook} usage`,
  );
}

for (const endpoint of ["/api/risk-assessment", "/api/risk-assessment/${assessmentId}"]) {
  assert.match(
    source,
    new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Risk Assessment should preserve existing endpoint path ${endpoint}`,
  );
}

assert.match(
  contextSource,
  /\/api\/risk-assessment\/sections/,
  "Risk Assessment should preserve section loading through the existing context endpoint",
);

assert.match(
  source,
  /selectedAssessment\.responses\s*\.filter/,
  "Assessment Details progress should include saved questionnaire responses",
);

assert.match(
  applyControlsSource,
  /bg-\[\#1E49E2\][^\n]*text-white/,
  "Suggested controls should expose a visible blue Apply button without optional stylesheet dependencies",
);

assert.match(
  applyControlsSource,
  /Load Control Suggestions/,
  "Risks without suggestions should expose a control-loading action",
);

for (const expected of [
  'aria-pressed={selectedAnswer === answer}',
  'setSelectedAnswers',
  'bg-[#009A44] text-white',
  'bg-[#E5001B] text-white',
  'bg-[#1E49E2] text-white',
  'backgroundColor:',
  'aria-disabled={!allQuestionsAnswered}',
]) {
  assert.match(
    questionnaireSource,
    new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Questionnaire choices should include ${expected}`,
  );
}

assert.match(
  source,
  /progress=\{workflowProgress\}/,
  "Assessment Details should render the dynamic workflow progress value",
);

assert.match(
  source,
  /if \(unansweredQuestions > 0\)/,
  "Questionnaire submission should guard against advancing with unanswered questions",
);

assert.match(
  source,
  /title: "Please answer all questions"/,
  "Incomplete questionnaire submission should show the requested popup message",
);

assert.match(
  source,
  /pr-16/,
  "Report preview header should leave room for the dialog close control",
);

assert.match(
  source,
  /sm:mr-10/,
  "Print PDF action should be spaced away from the dialog close control",
);

assert.match(
  reportSource,
  /View Report/,
  "Final report page primary action should be labelled View Report",
);

assert.doesNotMatch(
  reportSource,
  /Generate Report/,
  "Final report page should not show a separate Generate Report button",
);

assert.match(
  appSource,
  /\/risk-assessment\/new/,
  "Risk Assessment should expose a standalone create-assessment route",
);

assert.match(
  ciaWidgetSource,
  /grid w-full min-w-0 grid-cols-5/,
  "CIA rating widget should keep score buttons responsive in dialogs",
);

for (const handler of [
  "createAssessment",
  "submitResponseBatch",
  "analyzeAssessment",
  "suggestControls",
  "applyControl",
  "fetchResidual",
  "generateReport",
]) {
  assert.match(
    source,
    new RegExp(handler),
    `Risk Assessment should preserve existing ${handler} behavior`,
  );
}

for (const marker of [
  'data-risk-assessment-page="true"',
  'data-risk-assessment-new="true"',
  'risk-create-animated-bg',
  'data-risk-assessment-context-strip="true"',
  'data-risk-assessment-progress-ring="true"',
  'data-risk-assessment-feature-cards="true"',
  'data-risk-assessment-create="true"',
  'data-risk-assessment-scope-asset-scroll="true"',
  'data-risk-assessment-stepper="true"',
  'data-risk-assessment-step-tooltip="true"',
  'data-risk-assessment-questionnaire="true"',
  'data-risk-assessment-analysis="true"',
  'data-risk-assessment-risks="true"',
  'data-risk-assessment-controls="true"',
  'data-risk-assessment-residual="true"',
  'data-risk-assessment-report="true"',
  'data-risk-assessment-report-preview="true"',
  'data-risk-assessment-report-download="true"',
]) {
  assert.match(
    source,
    new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Risk Assessment should expose ${marker} for browser smoke checks`,
  );
}

for (const label of [
  "Risk Assessment Workspace",
  "New Assessment",
  "HowItWorks",
  "ACTIVE ASSESSMENTS",
  "HIGH / CRITICAL RISKS",
  "DRAFT ASSESSMENTS",
  "Create New Assessment",
  "Application Response Capture",
  "Running Risk Analysis",
  "Identified Risks",
  "Apply Controls To Risks",
  "Residual Risk Review",
  "Risk Assessment Report",
  "View Report",
  "Print PDF",
  "Workflow Summary",
  "Completion checklist",
  "Risk Review",
]) {
  assert.match(
    source,
    new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Risk Assessment should include the redesigned screen label ${label}`,
  );
}

for (const removed of [
  /data-risk-assessment-rail="true"/,
  /data-risk-assessment-dashboard="true"/,
  /Assessment Dashboard/,
]) {
  assert.doesNotMatch(
    source,
    removed,
    "Risk Assessment landing should not include the removed session rail or dashboard",
  );
}

for (const forbidden of [
  /trace-workbench-shell/,
  /trace-workbench-layout/,
  /rightTab/,
  /No assessments yet\. Create one to get started\./,
  /placeholder="Add evidence notes or observations \(optional\)"/,
  /placeholder="Add supporting detail or evidence notes"/,
  /Evidence notes added/,
  /View Generated Report/,
  /assessments\.slice\(0,\s*6\)/,
]) {
  assert.doesNotMatch(
    source,
    forbidden,
    "Risk Assessment should no longer use the older workbench layout patterns",
  );
}

const designDoc = read("../docs/ui-overhaul/risk-assessment-design.md");
const overhaulLog = read("../docs/ui-overhaul/ui-overhaul-log.md");

assert.match(
  designDoc,
  /Risk Assessment/,
  "Risk Assessment design reference should exist",
);

assert.match(
  overhaulLog,
  /Risk Assessment/,
  "The running UI overhaul log should include the Risk Assessment entry",
);
