import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const expectedRemote = "https://github.com/mantangurubimbel/dashboard-jawa-timur.git";
const expectedProject = "dashboard-jawa-timur";
const expectedProjectId = "prj_LG6Emkv0xQCwRaDAAKFfPB5wtYfM";
const expectedOrgId = "team_CXCbnkfI9ARTs0e2xU6xe8af";

function fail(message) {
  console.error(`Deployment check failed: ${message}`);
  process.exit(1);
}

let project;
try {
  project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
} catch {
  fail(".vercel/project.json is missing or invalid. Run `npx vercel link --project dashboard-jawa-timur --yes` first.");
}

if (project.projectName !== expectedProject) {
  fail(`Vercel project is ${project.projectName ?? "unset"}; expected ${expectedProject}.`);
}
if (project.projectId !== expectedProjectId || project.orgId !== expectedOrgId) {
  fail(`Vercel project identity is ${project.projectId ?? "unset"}/${project.orgId ?? "unset"}; expected ${expectedProjectId}/${expectedOrgId}.`);
}

let remote;
try {
  remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
} catch {
  fail("Git remote origin is unavailable.");
}

if (remote !== expectedRemote) {
  fail(`Git origin is ${remote}; expected ${expectedRemote}.`);
}

console.log(`Deployment target verified: ${expectedProject}`);
console.log(`Git origin verified: ${remote}`);
