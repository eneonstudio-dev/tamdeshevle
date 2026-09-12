import assert from "node:assert/strict";

const siteBase = process.env.PRODUCTION_BASE_URL || "https://eneonstudio-dev.github.io/tamdeshevle/";
const edgeBase =
  process.env.BAI_EDGE_BASE_URL ||
  "https://cxpneczhczashanbetgj.supabase.co/functions/v1/";

async function request(url, options = {}, timeoutMs = 20_000) {
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });

  return response;
}

async function expectPage(path, minimumBytes = 128) {
  const url = new URL(path, siteBase);
  const response = await request(url);
  assert.equal(response.status, 200, `${url} returned ${response.status}`);

  const body = await response.text();
  assert.ok(body.length >= minimumBytes, `${url} returned an unexpectedly small body`);
  return body;
}

function readCsp(html, pageName) {
  const match = html.match(
    /<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*content="([^"]+)"/i,
  );
  assert.ok(match, `${pageName} must ship a Content-Security-Policy`);
  return match[1];
}

function verifyCsp(csp, pageName) {
  for (const directive of [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ]) {
    assert.ok(csp.includes(directive), `${pageName} CSP is missing: ${directive}`);
  }

  assert.ok(!/(?:^|\s)http:\/\//i.test(csp), `${pageName} CSP allows an insecure origin`);
}

function verifyExternalScripts(html, pageName) {
  const tags = html.match(/<script\b[^>]*>/gi) || [];
  const externalTags = tags.filter((tag) => /\bsrc=["']https:\/\//i.test(tag));
  assert.ok(externalTags.length > 0, `${pageName} should contain a pinned external script`);

  for (const tag of externalTags) {
    const src = tag.match(/\bsrc=["']([^"']+)/i)?.[1] || "unknown";
    assert.match(tag, /\bintegrity=["']sha384-[^"']+["']/i, `${src} lacks SRI`);
    assert.match(tag, /\bcrossorigin=["']anonymous["']/i, `${src} lacks anonymous CORS`);
    assert.ok(!/@(?:latest|next)(?:\/|["'])/i.test(tag), `${src} uses a floating version`);
  }
}

async function expectEdgeDenied(functionName) {
  const url = new URL(functionName, edgeBase);
  const response = await request(
    url,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    },
    25_000,
  );
  const body = await response.text();

  assert.ok(
    response.status === 401 || response.status === 403,
    `${functionName} accepted an unauthenticated request (status ${response.status})`,
  );
  assert.ok(body.length < 2_048, `${functionName} returned an oversized error body`);
  assert.ok(
    !/(service_role|openai_api_key|stack trace|at file:\/\/)/i.test(body),
    `${functionName} leaked sensitive implementation details`,
  );
}

const indexHtml = await expectPage("");
const indexCsp = readCsp(indexHtml, "index.html");
verifyCsp(indexCsp, "index.html");
verifyExternalScripts(indexHtml, "index.html");
assert.match(
  indexHtml,
  /<meta\s+name=["']referrer["']\s+content=["']strict-origin-when-cross-origin["']/i,
  "index.html must ship a strict referrer policy",
);
assert.match(indexHtml, /<script\s+src=["']yandex-metrika\.js["']/i);

const adminHtml = await expectPage("bai-learning-admin.html");
verifyCsp(readCsp(adminHtml, "bai-learning-admin.html"), "bai-learning-admin.html");

await Promise.all([
  expectPage("app.js", 1_000),
  expectPage("catalog-boot.js", 1_000),
  expectPage("bai-assistant.js", 1_000),
  expectPage("yandex-metrika.js", 128),
]);

await Promise.all([
  expectEdgeDenied("bai-agent-core"),
  expectEdgeDenied("bai-learning-ingest"),
  expectEdgeDenied("bai-learning-admin"),
]);

console.log("Production security boundaries: pass");
