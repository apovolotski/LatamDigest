import { createRequire } from "node:module";

// Run after the workflow's clean, workspace-only install. A full backend install
// must fail this check so unrelated server/AI dependencies cannot creep back in.
const require = createRequire(new URL("../src/rssClient.js", import.meta.url));
require.resolve("fast-xml-parser");
for (const name of ["express", "body-parser", "openai", "zod", "cors", "dotenv", "node-cron"]) {
  try {
    require.resolve(name);
  } catch (error) {
    if (error.code === "MODULE_NOT_FOUND") continue;
    throw error;
  }
  throw new Error(`Optional backend dependency ${name} is installed in the static feed job. Use the isolated workspace install.`);
}
console.log("Static feed dependency isolation verified; optional backend packages are absent.");
