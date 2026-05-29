import { shell } from "electron";
import type { Credentials } from "google-auth-library";
import { google, sheets_v4 } from "googleapis";
import http from "node:http";
import { AddressInfo } from "node:net";
import { getPrisma } from "./database";
import { parseJsonArray } from "./serializers";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const JOB_LISTINGS_SHEET = "Job Listings";
const APPLICATIONS_SHEET = "Applications";

type GoogleTokenSettings = {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
};

type GoogleSheetsConfigInput = {
  clientId?: string;
  clientSecret?: string;
  spreadsheetId?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

async function setting(key: string): Promise<string> {
  const prisma = await getPrisma();
  return (await prisma.setting.findUnique({ where: { key } }))?.value ?? "";
}

async function saveSetting(key: string, value: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value, updatedAt: new Date() }
  });
}

async function deleteSetting(key: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.setting.deleteMany({ where: { key } });
}

function spreadsheetUrl(spreadsheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

function quoteSheetName(title: string): string {
  return `'${title.replace(/'/g, "''")}'`;
}

async function googleConfig() {
  return {
    clientId: await setting("googleSheetsClientId"),
    clientSecret: await setting("googleSheetsClientSecret"),
    spreadsheetId: await setting("googleSheetsSpreadsheetId"),
    lastSyncAt: await setting("googleSheetsLastSyncAt"),
    lastError: await setting("googleSheetsLastError")
  };
}

async function googleTokens(): Promise<GoogleTokenSettings | null> {
  const raw = await setting("googleSheetsTokens");
  if (!raw) {
    return null;
  }
  try {
    return compactTokens(JSON.parse(raw) as Credentials);
  } catch {
    return null;
  }
}

function compactTokens(tokens: Credentials | GoogleTokenSettings): GoogleTokenSettings {
  return {
    ...(tokens.access_token ? { access_token: tokens.access_token } : {}),
    ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
    ...(tokens.scope ? { scope: tokens.scope } : {}),
    ...(tokens.token_type ? { token_type: tokens.token_type } : {}),
    ...(tokens.expiry_date ? { expiry_date: tokens.expiry_date } : {})
  };
}

async function saveTokens(tokens: Credentials | GoogleTokenSettings): Promise<void> {
  await saveSetting("googleSheetsTokens", JSON.stringify(compactTokens(tokens)));
}

function oauthClient(clientId: string, clientSecret: string, redirectUri: string) {
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function authenticatedSheets() {
  const config = await googleConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Google OAuth client ID and client secret are required before connecting Google Sheets.");
  }
  const tokens = await googleTokens();
  if (!tokens?.refresh_token && !tokens?.access_token) {
    throw new Error("Google Sheets is not connected. Connect your Google account first.");
  }
  const client = oauthClient(config.clientId, config.clientSecret, "http://127.0.0.1");
  client.setCredentials(tokens);
  client.on("tokens", (nextTokens) => {
    void saveTokens({ ...tokens, ...nextTokens });
  });
  return google.sheets({ version: "v4", auth: client });
}

function waitForOAuthCode(server: http.Server): Promise<{ code: string; port: number }> {
  return new Promise((resolve, reject) => {
    server.on("request", (req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");
        if (error) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<h1>Google Sheets connection failed</h1><p>You can close this tab.</p>");
          reject(new Error(error));
          return;
        }
        if (!code) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Google Sheets connected</h1><p>You can close this tab and return to JobPilot.</p>");
        resolve({ code, port: (server.address() as AddressInfo).port });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1");
  });
}

export async function getGoogleSheetsStatus() {
  const [config, tokens] = await Promise.all([googleConfig(), googleTokens()]);
  return {
    clientIdSet: Boolean(config.clientId),
    clientSecretSet: Boolean(config.clientSecret),
    connected: Boolean(tokens?.refresh_token || tokens?.access_token),
    spreadsheetId: config.spreadsheetId || null,
    spreadsheetUrl: config.spreadsheetId ? spreadsheetUrl(config.spreadsheetId) : null,
    lastSyncAt: config.lastSyncAt || null,
    lastError: config.lastError || null
  };
}

export async function saveGoogleSheetsConfig(input: GoogleSheetsConfigInput) {
  if (input.clientId !== undefined) {
    await saveSetting("googleSheetsClientId", input.clientId.trim());
  }
  if (input.clientSecret !== undefined) {
    await saveSetting("googleSheetsClientSecret", input.clientSecret.trim());
  }
  if (input.spreadsheetId !== undefined) {
    const spreadsheetId = extractSpreadsheetId(input.spreadsheetId.trim());
    await saveSetting("googleSheetsSpreadsheetId", spreadsheetId);
  }
  return getGoogleSheetsStatus();
}

function extractSpreadsheetId(value: string): string {
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? value;
}

export async function connectGoogleSheets() {
  const config = await googleConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Add your Google OAuth client ID and client secret before connecting.");
  }

  const server = http.createServer();
  const codePromise = waitForOAuthCode(server);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
  const client = oauthClient(config.clientId, config.clientSecret, redirectUri);
  const authUrl = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES
  });
  await shell.openExternal(authUrl);
  const { code } = await codePromise;
  const { tokens } = await client.getToken(code);
  await saveTokens(tokens);
  await saveSetting("googleSheetsLastError", "");
  return getGoogleSheetsStatus();
}

export async function disconnectGoogleSheets(): Promise<void> {
  await deleteSetting("googleSheetsTokens");
}

export async function createGoogleSpreadsheet() {
  const sheets = await authenticatedSheets();
  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "JobPilot Sync" },
      sheets: [
        { properties: { title: JOB_LISTINGS_SHEET } },
        { properties: { title: APPLICATIONS_SHEET } }
      ]
    }
  });
  const spreadsheetId = response.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Google did not return a spreadsheet ID.");
  }
  await saveSetting("googleSheetsSpreadsheetId", spreadsheetId);
  await saveSetting("googleSheetsLastError", "");
  return getGoogleSheetsStatus();
}

async function ensureSheets(sheets: sheets_v4.Sheets, spreadsheetId: string): Promise<void> {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(spreadsheet.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean) as string[]);
  const requests: sheets_v4.Schema$Request[] = [];
  for (const title of [JOB_LISTINGS_SHEET, APPLICATIONS_SHEET]) {
    if (!existing.has(title)) {
      requests.push({ addSheet: { properties: { title } } });
    }
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
  }
}

function value(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return value;
  return String(value);
}

function listingAgeToDays(age: string | null | undefined): number {
  const match = age?.trim().match(/^(\d+)\s*([a-z]+)?/i);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? "d";
  if (unit === "m" || unit === "min" || unit === "mins" || unit === "minute" || unit === "minutes") return amount / 1440;
  if (unit === "h" || unit === "hr" || unit === "hrs" || unit === "hour" || unit === "hours") return amount / 24;
  if (unit === "w" || unit === "wk" || unit === "wks" || unit === "week" || unit === "weeks") return amount * 7;
  if (unit === "mo" || unit === "mon" || unit === "month" || unit === "months") return amount * 30;
  if (unit === "y" || unit === "yr" || unit === "yrs" || unit === "year" || unit === "years") return amount * 365;
  return amount;
}

async function jobListingRows() {
  const prisma = await getPrisma();
  const jobs = await prisma.importedJob.findMany({
    orderBy: [{ lastSeenAt: "desc" }, { importedAt: "desc" }]
  });
  const sortedJobs = jobs.sort((left, right) => {
    const ageDelta = listingAgeToDays(left.age) - listingAgeToDays(right.age);
    if (ageDelta !== 0) return ageDelta;
    return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
  });
  return [
    ["Imported Job ID", "Source", "Company", "Title", "Location", "Category", "Salary", "Posting URL", "Age", "Status", "Imported At", "Last Seen At", "Saved Job ID"],
    ...sortedJobs.map((job) => [
      job.id,
      job.sourceName,
      job.company,
      job.title,
      value(job.location),
      job.category,
      value(job.salary),
      job.postingUrl,
      value(job.age),
      job.status,
      value(job.importedAt),
      value(job.lastSeenAt),
      value(job.savedJobId)
    ])
  ];
}

async function applicationRows() {
  const prisma = await getPrisma();
  const applications = await prisma.application.findMany({
    include: { jobPosting: true, resume: true },
    orderBy: { updatedAt: "desc" }
  });
  return [
    ["Application ID", "Job ID", "Company", "Title", "Status", "Location", "Source", "Source URL", "Resume Used", "Match Score", "Priority", "Date Found", "Date Applied", "Updated At", "Notes", "Technologies"],
    ...applications.map((application) => [
      application.id,
      application.jobPostingId,
      application.jobPosting.company,
      application.jobPosting.title,
      application.status,
      value(application.jobPosting.location),
      application.jobPosting.source,
      value(application.jobPosting.sourceUrl),
      value(application.resume?.title),
      value(application.matchScore),
      value(application.priority),
      value(application.jobPosting.dateFound),
      value(application.dateApplied),
      value(application.updatedAt),
      value(application.notes),
      parseJsonArray(application.jobPosting.technologies).join(", ")
    ])
  ];
}

async function rewriteSheet(sheets: sheets_v4.Sheets, spreadsheetId: string, title: string, rows: Array<Array<string | number>>): Promise<void> {
  const quotedTitle = quoteSheetName(title);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quotedTitle}!A:Z`
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quotedTitle}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows }
  });
}

export async function syncGoogleSheets() {
  const config = await googleConfig();
  if (!config.spreadsheetId) {
    throw new Error("Add a spreadsheet ID or create a new Google spreadsheet before syncing.");
  }

  try {
    const sheets = await authenticatedSheets();
    await ensureSheets(sheets, config.spreadsheetId);
    const [jobs, applications] = await Promise.all([jobListingRows(), applicationRows()]);
    await rewriteSheet(sheets, config.spreadsheetId, JOB_LISTINGS_SHEET, jobs);
    await rewriteSheet(sheets, config.spreadsheetId, APPLICATIONS_SHEET, applications);
    const syncedAt = nowIso();
    await saveSetting("googleSheetsLastSyncAt", syncedAt);
    await saveSetting("googleSheetsLastError", "");
    return {
      spreadsheetId: config.spreadsheetId,
      spreadsheetUrl: spreadsheetUrl(config.spreadsheetId),
      jobListingsSynced: Math.max(0, jobs.length - 1),
      applicationsSynced: Math.max(0, applications.length - 1),
      syncedAt
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await saveSetting("googleSheetsLastError", message);
    throw err;
  }
}
