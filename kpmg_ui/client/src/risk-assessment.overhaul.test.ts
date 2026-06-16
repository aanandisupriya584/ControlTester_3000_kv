import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(relativePath), "utf8");
}

const source = read("client/src/pages/risk-assessment.tsx");
const featureCardsSource = read("client/src/pages/risk-assessment/components/FeatureCards.tsx");
const guidanceCardSource = read("client/src/pages/risk-assessment/components/GuidanceCard.tsx");
const newButtonSource = read("client/src/pages/risk-assessment/components/NewButton.tsx");
const questionnaireStepSource = read("client/src/pages/risk-assessment/components/QuestionnaireStep.tsx");
const recentAssessmentsSource = read("client/src/pages/risk-assessment/components/RecentAssessments.tsx");
const reportPreviewSource = read("client/src/pages/risk-assessment/components/ReportPreviewDialog.tsx");
const workflowControlsSource = read("client/src/pages/risk-assessment/components/WorkflowControls.tsx");
const workflowStepsSource = read("client/src/pages/risk-assessment/components/WorkflowSteps.tsx");
const workspaceHeaderSource = read("client/src/pages/risk-assessment/components/WorkspaceHeader.tsx");
const riskAssessmentUiSource = [
  source,
  featureCardsSource,
  guidanceCardSource,
  newButtonSource,
  questionnaireStepSource,
  recentAssessmentsSource,
  reportPreviewSource,
  workflowControlsSource,
  workflowStepsSource,
  workspaceHeaderSource,
].join("\n");
const appSource = read("client/src/App.tsx");
const contextSource = read("client/src/contexts/RiskAssessmentContext.tsx");
const ciaWidgetSource = read("client/src/components/CiaRatingWidget.tsx");

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
    riskAssessmentUiSource,
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
    riskAssessmentUiSource,
    new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `Risk Assessment should include the redesigned screen label ${label}`,
  );
}

assert.ok(
  source.indexOf("<FeatureCards") > -1 &&
    source.indexOf("<HowItWorks") > source.indexOf("<FeatureCards"),
  "Risk Assessment landing should show KPI boxes before How It Works",
);

assert.match(
  source,
  /!isCreatePage && !selectedAssessment/,
  "Risk Assessment landing KPI and How It Works content should hide while an assessment workflow is open",
);

assert.match(
  source,
  /data-risk-assessment-active-workspace="true"/,
  "Risk Assessment should expose a dedicated selected-assessment workspace view",
);

assert.match(
  workspaceHeaderSource,
  /Recent Assessments/,
  "Selected assessment workspace should include a Recent Assessments return action",
);

assert.match(
  featureCardsSource,
  /data-risk-assessment-feature-cards="true"/,
  "Risk Assessment KPI cards should live in the extracted feature cards component",
);

assert.match(
  recentAssessmentsSource,
  /Recent Assessments/,
  "Recent assessments list should live in the extracted recent assessments component",
);

assert.match(
  workflowControlsSource,
  /data-risk-assessment-stepper="true"/,
  "Risk Assessment workflow controls should live in the extracted workflow component",
);

assert.match(
  reportPreviewSource,
  /data-risk-assessment-report-preview="true"/,
  "Risk Assessment report preview should live in the extracted report component",
);

assert.match(
  source,
  /@\/pages\/risk-assessment\/components/,
  "Risk Assessment page should import child components from its local component folder",
);

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

assert.match(
  source,
  /Please complete all the questions/,
  "Risk Assessment questionnaire should warn before proceeding with unanswered questions",
);

assert.match(
  source,
  /isAssetQuestionnaireComplete\(currentAssetId\)/,
  "Risk Assessment questionnaire submit should require every question to be answered",
);

assert.match(
  source,
  /Questionnaire:\s*hasQuestionnaireSubmitted \|\| hasRisksIdentified/,
  "Questionnaire workflow tick should wait for complete submitted responses or analysed risks",
);

assert.doesNotMatch(
  source,
  /answer:\s*\(local\?\.answer \?\? "na"\)/,
  "Risk Assessment questionnaire should not silently default unanswered questions to NA on submit",
);

