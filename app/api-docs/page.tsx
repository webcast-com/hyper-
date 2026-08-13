import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";

type Operation = { summary?: string; tags?: string[] };
type OpenApi = { info: { title: string; version: string; description?: string }; paths: Record<string, Record<string, Operation>> };

export default async function ApiDocsPage() {
  const spec = JSON.parse(await fs.readFile(path.join(process.cwd(), "public", "openapi.json"), "utf8")) as OpenApi;
  const endpoints = Object.entries(spec.paths).flatMap(([route, methods]) => Object.entries(methods).map(([method, operation]) => ({ route, method: method.toUpperCase(), summary: operation.summary || "", tag: operation.tags?.[0] || "Other" })));
  const groups = endpoints.reduce<Record<string, typeof endpoints>>((acc, endpoint) => {
    acc[endpoint.tag] ||= [];
    acc[endpoint.tag].push(endpoint);
    return acc;
  }, {});

  return (
    <main className="shell page-wrap">
      <div className="split"><Link className="btn ghost small" href="/">← Home</Link><h2>API docs</h2><a className="btn small" href="/openapi.json">Download OpenAPI</a></div>
      <section className="explore-hero card">
        <span className="eyebrow">📘 OpenAPI {spec.info.version}</span>
        <h1><span className="gradient-text">{spec.info.title}</span><br />Backend contract for clients.</h1>
        <p className="lead">{spec.info.description}</p>
        <div className="row"><a className="btn" href="/api/openapi">JSON endpoint</a><a className="btn ghost" href="/openapi.json">Static spec</a></div>
      </section>
      {Object.entries(groups).map(([tag, items]) => <section className="card" key={tag}><h3>{tag}</h3><div className="api-list">{items.map((item) => <div className="api-row" key={`${item.method}-${item.route}`}><code>{item.method}</code><strong>{item.route}</strong><span>{item.summary}</span></div>)}</div></section>)}
    </main>
  );
}
