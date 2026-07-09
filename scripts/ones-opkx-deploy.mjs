#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { constants, createHash, publicEncrypt, randomBytes } from "node:crypto";
import { basename, resolve } from "node:path";

const DEFAULT_BASE_URL = "https://demo-plugin.ones.pro";
const FINAL_RESULTS = new Set(["SUCCESS", "FAILED"]);
const FINAL_STATUS = new Set(["DONE", "DONE_ROLLBACK", "CANCELLED"]);

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.ONES_BASE_URL || DEFAULT_BASE_URL,
    file: "",
    har: process.env.ONES_HAR || "",
    cookie: process.env.ONES_COOKIE || "",
    authorization: process.env.ONES_AUTHORIZATION || "",
    email: process.env.ONES_EMAIL || "",
    password: process.env.ONES_PASSWORD || "",
    orgUuid: process.env.ONES_ORG_UUID || "",
    autoEnable: process.env.ONES_AUTO_ENABLE !== "false",
    parseOnly: false,
    poll: true,
    pollIntervalMs: Number(process.env.ONES_POLL_INTERVAL_MS || 3000),
    pollTimeoutMs: Number(process.env.ONES_POLL_TIMEOUT_MS || 5 * 60 * 1000),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[index];
    };

    switch (arg) {
      case "--base-url":
        args.baseUrl = next();
        break;
      case "--file":
        args.file = next();
        break;
      case "--har":
        args.har = next();
        break;
      case "--cookie":
        args.cookie = next();
        break;
      case "--authorization":
        args.authorization = next();
        break;
      case "--email":
        args.email = next();
        break;
      case "--password":
        args.password = next();
        break;
      case "--org-uuid":
        args.orgUuid = next();
        break;
      case "--auto-enable":
        args.autoEnable = true;
        break;
      case "--no-auto-enable":
        args.autoEnable = false;
        break;
      case "--parse-only":
        args.parseOnly = true;
        break;
      case "--no-poll":
        args.poll = false;
        break;
      case "--poll-interval-ms":
        args.pollIntervalMs = Number(next());
        break;
      case "--poll-timeout-ms":
        args.pollTimeoutMs = Number(next());
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.file) {
    throw new Error("Missing --file <path-to.opkx>");
  }

  args.baseUrl = args.baseUrl.replace(/\/+$/, "");
  args.file = resolve(args.file);
  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/ones-opkx-deploy.mjs --file dist/agent-platform-v0.2.1.opkx [options]

Options:
  --base-url <url>          ONES base URL. Default: ${DEFAULT_BASE_URL}
  --file <path>             OPKX package path.
  --har <path>              Optional HAR file used to extract Cookie/Authorization when present.
  --cookie <cookie>         Session Cookie. Or set ONES_COOKIE.
  --authorization <value>   Authorization header. Or set ONES_AUTHORIZATION.
  --email <email>           Login email. Or set ONES_EMAIL.
  --password <password>     Login password. Or set ONES_PASSWORD.
  --org-uuid <uuid>         Optional org UUID, used only for Referer.
  --auto-enable             Enable app after first install. Default.
  --no-auto-enable          Do not enable app after first install.
  --parse-only              Upload and parse, then stop before install/upgrade.
  --no-poll                 Start executor, then stop without polling.
  --poll-interval-ms <n>    Poll interval. Default: 3000.
  --poll-timeout-ms <n>     Poll timeout. Default: 300000.
`);
}

function getSetCookies(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];
  const fallback = response.headers.get("set-cookie");
  return (values.length ? values : fallback ? [fallback] : [])
    .map((value) => value.split(";")[0])
    .filter(Boolean);
}

function addCookies(cookieJar, response) {
  for (const cookie of getSetCookies(response)) {
    const name = cookie.split("=")[0];
    cookieJar.set(name, cookie);
  }
}

function toCookieHeader(cookieJar) {
  return Array.from(cookieJar.values()).join("; ");
}

function createCodeVerifier() {
  return randomBytes(64).toString("base64url").slice(0, 64);
}

function createCodeChallenge(codeVerifier) {
  return createHash("sha256").update(codeVerifier).digest("base64url");
}

async function readJsonResponse(response, label) {
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`${label} returned non-JSON response: ${text.slice(0, 300)}`);
    }
  }
  if (!response.ok) {
    const message = json?.message || json?.errcode || json?.error || response.statusText;
    throw new Error(`${label} failed: ${response.status} ${message}`);
  }
  return json;
}

async function loginWithPassword(args) {
  if (!args.email && !args.password) {
    return {};
  }
  if (!args.email || !args.password) {
    throw new Error("Both --email and --password are required for password login.");
  }
  if (!args.orgUuid) {
    throw new Error("--org-uuid is required for password login.");
  }

  const cookieJar = new Map();
  const certResponse = await fetch(`${args.baseUrl}/identity/api/encryption_cert`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  addCookies(cookieJar, certResponse);
  const cert = await readJsonResponse(certResponse, "Fetch encryption cert");
  const publicKey = cert.public_key || cert.data?.public_key;
  if (!publicKey) {
    throw new Error("Encryption cert response did not include public_key.");
  }

  const encryptedPassword = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(args.password),
  ).toString("base64");

  const loginResponse = await fetch(`${args.baseUrl}/identity/api/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Cookie: toCookieHeader(cookieJar),
    },
    body: JSON.stringify({ email: args.email, password: encryptedPassword }),
  });
  addCookies(cookieJar, loginResponse);
  const login = await readJsonResponse(loginResponse, "Password login");
  const orgUsers = login.org_users || login.data?.org_users || [];
  const orgUser = orgUsers.find((item) => item.org_uuid === args.orgUuid);
  if (!orgUser) {
    throw new Error(`Login succeeded, but org ${args.orgUuid} was not found in org_users.`);
  }

  const codeVerifier = createCodeVerifier();
  const authorizeBody = new URLSearchParams({
    client_id: "ones.v1",
    scope: `openid offline_access ones:org:${orgUser.org.region_uuid}:${orgUser.org_uuid}:${orgUser.org_user.org_user_uuid}`,
    response_type: "code",
    code_challenge_method: "S256",
    code_challenge: createCodeChallenge(codeVerifier),
    redirect_uri: `${args.baseUrl}/auth/authorize/callback`,
    state: new URLSearchParams({ org_uuid: args.orgUuid }).toString(),
  });

  const authorizeResponse = await fetch(`${args.baseUrl}/identity/authorize`, {
    method: "POST",
    redirect: "manual",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: toCookieHeader(cookieJar),
    },
    body: authorizeBody.toString(),
  });
  addCookies(cookieJar, authorizeResponse);
  const location = authorizeResponse.headers.get("location");
  const code = location ? new URL(location, args.baseUrl).searchParams.get("code") : "";
  if (!code) {
    const body = await authorizeResponse.text();
    throw new Error(`Authorize did not return an authorization code: ${authorizeResponse.status} ${body.slice(0, 300)}`);
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: "ones.v1",
    code,
    code_verifier: codeVerifier,
    redirect_uri: `${args.baseUrl}/auth/authorize/callback`,
  });
  const tokenResponse = await fetch(`${args.baseUrl}/identity/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: toCookieHeader(cookieJar),
    },
    body: tokenBody.toString(),
  });
  addCookies(cookieJar, tokenResponse);
  const token = await readJsonResponse(tokenResponse, "Token exchange");
  if (!token.access_token) {
    throw new Error("Token exchange response did not include access_token.");
  }

  return {
    authorization: `${token.token_type || "Bearer"} ${token.access_token}`,
    cookie: toCookieHeader(cookieJar),
  };
}

async function loadHarAuth(harPath, baseUrl) {
  if (!harPath) {
    return {};
  }

  const har = JSON.parse(await readFile(resolve(harPath), "utf8"));
  const entries = har?.log?.entries || [];
  const target = entries.find((entry) => {
    const url = entry?.request?.url || "";
    return url.startsWith(baseUrl) && url.includes("/platform/");
  });

  const headers = target?.request?.headers || [];
  const result = {};
  for (const header of headers) {
    const name = String(header.name || "").toLowerCase();
    if (name === "cookie") {
      result.cookie = header.value;
    }
    if (name === "authorization") {
      result.authorization = header.value;
    }
  }
  return result;
}

function buildHeaders(args) {
  const refererPath = args.orgUuid
    ? `/project/#/org/${args.orgUuid}/setting/app_manager`
    : "/project/";
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh",
    Origin: args.baseUrl,
    Referer: `${args.baseUrl}${refererPath}`,
  };

  if (args.cookie) {
    headers.Cookie = args.cookie;
  }
  if (args.authorization) {
    headers.Authorization = args.authorization;
  }
  return headers;
}

async function requestJson(args, path, options = {}) {
  const url = `${args.baseUrl}/platform/${path.replace(/^\/+/, "")}`;
  const headers = {
    ...args.headers,
    ...(options.headers || {}),
  };

  let body = options.body;
  if (body !== undefined && typeof body !== "string") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body,
  });

  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      // Keep raw body for non-JSON platform failures.
    }
  }

  if (!response.ok || json?.code && json.code !== "OK") {
    const message = json?.message || json?.code || text || response.statusText;
    const details = json?.details ? ` ${JSON.stringify(json.details)}` : "";
    throw new Error(`${options.method || "GET"} ${url} failed: ${message}${details}`);
  }

  return json?.data ?? json;
}

async function uploadPackage(args) {
  console.log(`Uploading ${basename(args.file)}...`);
  const preSigned = await requestJson(args, "runtime_manager/opkx/pre_signed_upload", {
    method: "POST",
  });

  const buffer = await readFile(args.file);
  const form = new FormData();
  for (const [key, value] of Object.entries(preSigned.fields || {})) {
    form.append(key, value);
  }
  form.append("file", new Blob([buffer], { type: "application/octet-stream" }), basename(args.file));

  const uploadResponse = await fetch(preSigned.url, {
    method: "POST",
    body: form,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`);
  }

  return preSigned.fields.key;
}

async function parsePackage(args, objectKey) {
  console.log(`Parsing package object ${objectKey}...`);
  return requestJson(args, "runtime_manager/opkx/parse", {
    method: "POST",
    body: { object_key: objectKey },
  });
}

async function getInstalledApp(args, appId) {
  const search = new URLSearchParams({ app_id: appId });
  const apps = await requestJson(args, `api/app/list?${search.toString()}`);
  return Array.isArray(apps) ? apps[0] : null;
}

async function startExecutor(args, parsed, installedApp) {
  const appId = parsed.app_id;
  const opkxId = parsed.opkx_id;
  if (!opkxId) {
    throw new Error("Parse response did not include opkx_id; cannot use hosted executor deploy API.");
  }

  if (installedApp) {
    console.log(`Upgrading ${appId} from ${installedApp.app_version || "unknown"}...`);
    return requestJson(args, "runtime_manager/app_hosted_task_executor/update", {
      method: "POST",
      body: { app_id: appId, opkx_id: opkxId },
    });
  }

  console.log(`Installing ${appId}...`);
  return requestJson(args, "runtime_manager/app_hosted_task_executor/create", {
    method: "POST",
    body: { opkx_id: opkxId, options: { enable: args.autoEnable } },
  });
}

async function getExecutorDetail(args, executorId) {
  return requestJson(args, `runtime_manager/app_hosted_task_executor/${executorId}/detail`, {
    method: "POST",
  });
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function pollExecutor(args, executorId) {
  const start = Date.now();
  let lastLineCount = 0;

  while (Date.now() - start <= args.pollTimeoutMs) {
    const detail = await getExecutorDetail(args, executorId);
    const logs = Array.isArray(detail.log_data) ? detail.log_data : [];
    for (const log of logs.slice(lastLineCount)) {
      const level = log.level || "INFO";
      const taskName = log.task_name ? `[${log.task_name}] ` : "";
      console.log(`${level} ${taskName}${log.log}`);
    }
    lastLineCount = logs.length;

    const done = FINAL_RESULTS.has(detail.result) || FINAL_STATUS.has(detail.status);
    if (done) {
      return detail;
    }
    await sleep(args.pollIntervalMs);
  }

  throw new Error(`Timed out while polling executor ${executorId}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loginAuth = await loginWithPassword(args);
  const harAuth = await loadHarAuth(args.har, args.baseUrl);
  args.cookie ||= loginAuth.cookie || "";
  args.authorization ||= loginAuth.authorization || "";
  args.cookie ||= harAuth.cookie || "";
  args.authorization ||= harAuth.authorization || "";
  args.headers = buildHeaders(args);

  if (!args.cookie && !args.authorization) {
    console.warn("Warning: no Cookie or Authorization found. Set ONES_COOKIE/ONES_AUTHORIZATION or pass --cookie/--authorization.");
  }

  const objectKey = await uploadPackage(args);
  const parsed = await parsePackage(args, objectKey);
  const app = parsed.opkx_content?.app || {};
  const version = app.app_version || app.version || "unknown";
  console.log(`Parsed ${app.name || parsed.app_id} ${version}; opkx_id=${parsed.opkx_id}`);

  if (args.parseOnly) {
    console.log(JSON.stringify(parsed, null, 2));
    return;
  }

  const installedApp = await getInstalledApp(args, parsed.app_id);
  const executor = await startExecutor(args, parsed, installedApp);
  const executorId = executor.executor_id;
  if (!executorId) {
    console.log(JSON.stringify(executor, null, 2));
    throw new Error("Deploy API did not return executor_id.");
  }
  console.log(`Executor started: ${executorId}`);

  if (!args.poll) {
    return;
  }

  const detail = await pollExecutor(args, executorId);
  console.log(`Executor finished: status=${detail.status} result=${detail.result}`);
  if (detail.result && detail.result !== "SUCCESS") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
