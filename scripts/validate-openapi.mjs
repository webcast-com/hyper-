import { readFile } from "node:fs/promises";

const spec = JSON.parse(await readFile("public/openapi.json", "utf8"));
const required = ["openapi", "info", "paths"];
for (const key of required) {
  if (!spec[key]) throw new Error(`OpenAPI spec missing ${key}`);
}
if (!String(spec.openapi).startsWith("3.")) throw new Error("OpenAPI version must be 3.x");
const paths = Object.keys(spec.paths || {});
if (paths.length < 10) throw new Error("OpenAPI spec should document core paths");
for (const [route, methods] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(methods)) {
    if (!operation.responses) throw new Error(`${method.toUpperCase()} ${route} missing responses`);
  }
}
console.log(`OpenAPI spec valid: ${paths.length} paths`);
