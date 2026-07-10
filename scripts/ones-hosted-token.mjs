#!/usr/bin/env node

import { constants, createHash, publicEncrypt, randomBytes } from 'node:crypto';

const DEFAULT_BASE_URL = 'https://demo-plugin.ones.pro';

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.ONES_BASE_URL || DEFAULT_BASE_URL,
    email: process.env.ONES_EMAIL || '',
    password: process.env.ONES_PASSWORD || '',
    orgUuid: process.env.ONES_ORG_UUID || '',
    appId: process.env.ONES_APP_ID || 'app_agentplatform001',
    installationId: process.env.ONES_INSTALLATION_ID || '',
    format: process.env.ONES_TOKEN_FORMAT || 'json'
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
      case '--base-url':
        args.baseUrl = next();
        break;
      case '--email':
        args.email = next();
        break;
      case '--password':
        args.password = next();
        break;
      case '--org-uuid':
        args.orgUuid = next();
        break;
      case '--app-id':
        args.appId = next();
        break;
      case '--installation-id':
        args.installationId = next();
        break;
      case '--format':
        args.format = next();
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.email || !args.password || !args.orgUuid) {
    throw new Error('ONES_EMAIL, ONES_PASSWORD, and ONES_ORG_UUID are required.');
  }

  if (!['json', 'env'].includes(args.format)) {
    throw new Error('--format must be json or env.');
  }

  args.baseUrl = args.baseUrl.replace(/\/+$/, '');
  return args;
}

function printHelp() {
  console.log(`Usage:
  ONES_EMAIL=... ONES_PASSWORD=... ONES_ORG_UUID=... node scripts/ones-hosted-token.mjs [options]

Options:
  --base-url <url>          ONES base URL. Default: ${DEFAULT_BASE_URL}
  --app-id <id>             Hosted app id. Default: app_agentplatform001
  --installation-id <id>    Optional installed app id. Skips app lookup when set.
  --format <json|env>       Output format. Default: json
`);
}

function getSetCookies(response) {
  const values =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
  const fallback = response.headers.get('set-cookie');
  return (values.length ? values : fallback ? [fallback] : [])
    .map((value) => value.split(';')[0])
    .filter(Boolean);
}

function addCookies(cookieJar, response) {
  for (const cookie of getSetCookies(response)) {
    const name = cookie.split('=')[0];
    cookieJar.set(name, cookie);
  }
}

function toCookieHeader(cookieJar) {
  return Array.from(cookieJar.values()).join('; ');
}

function createCodeVerifier() {
  return randomBytes(64).toString('base64url').slice(0, 64);
}

function createCodeChallenge(codeVerifier) {
  return createHash('sha256').update(codeVerifier).digest('base64url');
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
  const cookieJar = new Map();
  const certResponse = await fetch(`${args.baseUrl}/identity/api/encryption_cert`, {
    method: 'POST',
    headers: { Accept: 'application/json' }
  });
  addCookies(cookieJar, certResponse);
  const cert = await readJsonResponse(certResponse, 'Fetch encryption cert');
  const publicKey = cert.public_key || cert.data?.public_key;
  if (!publicKey) {
    throw new Error('Encryption cert response did not include public_key.');
  }

  const encryptedPassword = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
    Buffer.from(args.password)
  ).toString('base64');

  const loginResponse = await fetch(`${args.baseUrl}/identity/api/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: toCookieHeader(cookieJar)
    },
    body: JSON.stringify({ email: args.email, password: encryptedPassword })
  });
  addCookies(cookieJar, loginResponse);
  const login = await readJsonResponse(loginResponse, 'Password login');
  const orgUsers = login.org_users || login.data?.org_users || [];
  const orgUser = orgUsers.find((item) => item.org_uuid === args.orgUuid);
  if (!orgUser) {
    throw new Error(`Login succeeded, but org ${args.orgUuid} was not found.`);
  }

  const codeVerifier = createCodeVerifier();
  const authorizeBody = new URLSearchParams({
    client_id: 'ones.v1',
    scope: `openid offline_access ones:org:${orgUser.org.region_uuid}:${orgUser.org_uuid}:${orgUser.org_user.org_user_uuid}`,
    response_type: 'code',
    code_challenge_method: 'S256',
    code_challenge: createCodeChallenge(codeVerifier),
    redirect_uri: `${args.baseUrl}/auth/authorize/callback`,
    state: new URLSearchParams({ org_uuid: args.orgUuid }).toString()
  });

  const authorizeResponse = await fetch(`${args.baseUrl}/identity/authorize`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      Accept: '*/*',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: toCookieHeader(cookieJar)
    },
    body: authorizeBody.toString()
  });
  addCookies(cookieJar, authorizeResponse);
  const location = authorizeResponse.headers.get('location');
  const code = location ? new URL(location, args.baseUrl).searchParams.get('code') : '';
  if (!code) {
    const body = await authorizeResponse.text();
    throw new Error(
      `Authorize did not return an authorization code: ${authorizeResponse.status} ${body.slice(0, 300)}`
    );
  }

  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: 'ones.v1',
    code,
    code_verifier: codeVerifier,
    redirect_uri: `${args.baseUrl}/auth/authorize/callback`
  });
  const tokenResponse = await fetch(`${args.baseUrl}/identity/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: toCookieHeader(cookieJar)
    },
    body: tokenBody.toString()
  });
  addCookies(cookieJar, tokenResponse);
  const token = await readJsonResponse(tokenResponse, 'Token exchange');
  if (!token.access_token) {
    throw new Error('Token exchange response did not include access_token.');
  }

  return {
    authorization: `${token.token_type || 'Bearer'} ${token.access_token}`,
    cookie: toCookieHeader(cookieJar)
  };
}

async function platformRequest(args, auth, path) {
  const response = await fetch(`${args.baseUrl}/platform/${path.replace(/^\/+/, '')}`, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      Authorization: auth.authorization,
      Cookie: auth.cookie,
      Origin: args.baseUrl,
      Referer: `${args.baseUrl}/project/#/org/${args.orgUuid}/setting/app_manager`
    }
  });
  const json = await readJsonResponse(response, `GET /platform/${path}`);
  if (json?.code && json.code !== 'OK') {
    throw new Error(`GET /platform/${path} failed: ${json.message || json.code}`);
  }
  return json?.data ?? json;
}

async function resolveInstallationId(args, auth) {
  if (args.installationId) {
    return args.installationId;
  }

  const search = new URLSearchParams({ app_id: args.appId });
  const apps = await platformRequest(args, auth, `api/app/list?${search.toString()}`);
  const installed = Array.isArray(apps) ? apps[0] : null;
  if (!installed?.installation_id) {
    throw new Error(`Installed app not found for app id ${args.appId}.`);
  }
  return installed.installation_id;
}

function quoteEnvValue(value) {
  return JSON.stringify(String(value));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const auth = await loginWithPassword(args);
  const installationId = await resolveInstallationId(args, auth);
  const tokenInfo = await platformRequest(args, auth, `api/app/${installationId}/token`);

  const result = {
    appId: args.appId,
    installationId,
    token: tokenInfo.token,
    appBaseUrl: tokenInfo.app_base_url,
    managerBaseUrl: `${args.baseUrl}/platform/runtime_manager`
  };

  if (!result.token) {
    throw new Error('Install token response did not include token.');
  }

  if (args.format === 'env') {
    console.log(`ONES_HOSTED_TOKEN=${quoteEnvValue(result.token)}`);
    console.log(`ONES_HOSTED_APP_ID=${quoteEnvValue(result.appId)}`);
    console.log(`ONES_HOSTED_MANAGER_BASE_URL=${quoteEnvValue(result.managerBaseUrl)}`);
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
