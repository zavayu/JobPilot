import crypto from "node:crypto";

export const SPEEDYAPPLY_SOURCE_NAME = "speedyapply_new_grad_usa";
export const SIMPLIFY_SOURCE_NAME = "simplify_new_grad_positions";

export const DEFAULT_NEW_GRAD_JOBS_URL =
  "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/NEW_GRAD_USA.md";

export const DEFAULT_SIMPLIFY_JOBS_URL = "https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md";

export type JobImportSourceConfig = {
  id: string;
  name: string;
  provider: string;
  url: string;
  enabled: boolean;
};

export type ParsedImportedJob = {
  sourceKey: string;
  canonicalUrl: string;
  dedupeKey: string;
  company: string;
  companyUrl?: string | null;
  title: string;
  location?: string | null;
  salary?: string | null;
  postingUrl: string;
  age?: string | null;
  category: string;
  rawMarkdown: string;
};

export type JobSourceProvider = {
  id: string;
  name: string;
  defaultUrl: string;
  sourceRepo: string;
  parse: (markdown: string) => ParsedImportedJob[];
};

const TRACKING_PARAMS = new Set([
  "gh_src",
  "ref",
  "source",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term"
]);

export function defaultJobImportSources(): JobImportSourceConfig[] {
  return [
    {
      id: SPEEDYAPPLY_SOURCE_NAME,
      name: "SpeedyApply 2026 SWE College Jobs",
      provider: SPEEDYAPPLY_SOURCE_NAME,
      url: DEFAULT_NEW_GRAD_JOBS_URL,
      enabled: true
    },
    {
      id: SIMPLIFY_SOURCE_NAME,
      name: "Simplify New Grad Positions",
      provider: SIMPLIFY_SOURCE_NAME,
      url: DEFAULT_SIMPLIFY_JOBS_URL,
      enabled: true
    }
  ];
}

function hash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function splitMarkdownRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function splitHtmlCells(row: string): string[] {
  const cells: string[] = [];
  for (const match of row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)) {
    cells.push(match[1].trim());
  }
  return cells;
}

function htmlRows(markdown: string): string[] {
  return Array.from(markdown.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi), (match) => match[1]);
}

function hrefs(value: string): string[] {
  const urls: string[] = [];
  for (const match of value.matchAll(/href="([^"]+)"/gi)) {
    urls.push(match[1]);
  }
  for (const match of value.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    urls.push(match[1]);
  }
  return urls;
}

function firstHref(value: string): string | null {
  return hrefs(value)[0] ?? null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/br>/gi, " ")
    .replace(/<img\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function cleanCompany(value: string): string {
  return stripHtml(value)
    .replace(/^[^\w]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalizePostingUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();
    const rendered = parsed.toString();
    return rendered.endsWith("/") ? rendered.slice(0, -1) : rendered;
  } catch {
    return url.trim().toLowerCase();
  }
}

function atsKeyFromUrl(canonicalUrl: string): string | null {
  try {
    const parsed = new URL(canonicalUrl);
    const host = parsed.hostname.toLowerCase();
    const path = decodeURIComponent(parsed.pathname);
    if (host.includes("greenhouse.io")) {
      const match = path.match(/\/jobs\/(\d+)/i);
      return match ? `greenhouse:${match[1]}` : null;
    }
    if (host.includes("lever.co")) {
      const parts = path.split("/").filter(Boolean);
      return parts.length >= 2 ? `lever:${parts[0]}:${parts[1]}` : null;
    }
    if (host.includes("myworkdayjobs.com")) {
      const match = path.match(/\/([^/]*?(?:JR|R|REQ)[A-Z0-9_-]+)$/i) ?? path.match(/\/([^/]+)$/);
      return match ? `workday:${match[1].toLowerCase()}` : null;
    }
    if (host.includes("ashbyhq.com")) {
      const parts = path.split("/").filter(Boolean);
      return parts.length >= 2 ? `ashby:${parts.slice(-2).join(":").toLowerCase()}` : null;
    }
    if (host.includes("smartrecruiters.com")) {
      const parts = path.split("/").filter(Boolean);
      return parts.length ? `smartrecruiters:${parts.at(-1)?.toLowerCase()}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function buildKeys(sourceId: string, company: string, title: string, location: string | null | undefined, postingUrl: string) {
  const canonicalUrl = canonicalizePostingUrl(postingUrl);
  const atsKey = atsKeyFromUrl(canonicalUrl);
  const semanticKey = [
    normalizeText(company),
    normalizeText(title),
    normalizeText(location)
  ].join("|");
  return {
    sourceKey: hash([sourceId, canonicalUrl, company, title, location ?? ""].join("|").toLowerCase()),
    canonicalUrl,
    dedupeKey: hash(atsKey ?? (canonicalUrl || semanticKey))
  };
}

function categoryFromSpeedyApplyMarker(line: string, current: string): string {
  if (line.includes("TABLE_FAANG_START")) return "FAANG+";
  if (line.includes("TABLE_QUANT_START")) return "Quant";
  if (line.includes("TABLE_START")) return "Other";
  return current;
}

function categoryFromSimplifyHeading(line: string, current: string): string {
  const match = line.match(/^##\s+(.+?)\s+New Grad Roles/i);
  if (!match) {
    return current;
  }
  return stripHtml(match[1]).replace(/^[^\w]+/, "").trim() || current;
}

function choosePostingUrl(cell: string): string | null {
  const links = hrefs(cell).filter((url) => !url.includes("raw.githubusercontent.com"));
  const direct = links.find((url) => !url.includes("simplify.jobs")) ?? links[0];
  return direct ?? null;
}

function parsedJob(
  sourceId: string,
  input: Omit<ParsedImportedJob, "sourceKey" | "canonicalUrl" | "dedupeKey">
): ParsedImportedJob | null {
  const company = cleanCompany(input.company);
  const title = stripHtml(input.title);
  const location = stripHtml(input.location ?? "");
  const postingUrl = input.postingUrl.trim();
  if (!company || !title || !postingUrl) {
    return null;
  }
  return {
    ...buildKeys(sourceId, company, title, location, postingUrl),
    ...input,
    company,
    title,
    location,
    postingUrl
  };
}

export function parseSpeedyApplyMarkdown(markdown: string): ParsedImportedJob[] {
  const jobs: ParsedImportedJob[] = [];
  let category = "";

  for (const line of markdown.split(/\r?\n/)) {
    category = categoryFromSpeedyApplyMarker(line, category);
    const cells = splitMarkdownRow(line);
    if (cells.length < 5 || cells[0] === "---" || cells[0].toLowerCase() === "company") {
      continue;
    }

    const hasSalary = cells.length >= 6;
    const salaryCell = hasSalary ? cells[3] : null;
    const postingCell = hasSalary ? cells[4] : cells[3];
    const ageCell = hasSalary ? cells[5] : cells[4];
    const postingUrl = choosePostingUrl(postingCell);
    if (!postingUrl) {
      continue;
    }

    const job = parsedJob(SPEEDYAPPLY_SOURCE_NAME, {
      company: cells[0],
      companyUrl: firstHref(cells[0]),
      title: cells[1],
      location: cells[2],
      salary: salaryCell ? stripHtml(salaryCell) : null,
      postingUrl,
      age: stripHtml(ageCell),
      category: category || "Other",
      rawMarkdown: line
    });
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

export function parseSimplifyMarkdown(markdown: string): ParsedImportedJob[] {
  const jobs: ParsedImportedJob[] = [];
  let category = "Other";
  let inInactiveRoles = false;

  for (const line of markdown.split(/\r?\n/)) {
    category = categoryFromSimplifyHeading(line, category);
    if (/inactive roles/i.test(line)) {
      inInactiveRoles = true;
    }
    if (inInactiveRoles) {
      continue;
    }

    const cells = splitMarkdownRow(line);
    if (cells.length < 5 || cells[0] === "---" || cells[0].toLowerCase() === "company") {
      continue;
    }

    const postingUrl = choosePostingUrl(cells[3]);
    if (!postingUrl) {
      continue;
    }

    const job = parsedJob(SIMPLIFY_SOURCE_NAME, {
      company: cells[0],
      companyUrl: firstHref(cells[0]),
      title: cells[1],
      location: cells[2],
      salary: null,
      postingUrl,
      age: stripHtml(cells[4]),
      category,
      rawMarkdown: line
    });
    if (job) {
      jobs.push(job);
    }
  }

  if (jobs.length) {
    return jobs;
  }

  category = "Other";
  const sections = markdown.split(/(?=^##\s+)/m);
  for (const section of sections) {
    const heading = section.split(/\r?\n/, 1)[0] ?? "";
    category = categoryFromSimplifyHeading(heading, category);
    if (/inactive roles/i.test(heading)) {
      continue;
    }

    for (const row of htmlRows(section)) {
      const cells = splitHtmlCells(row);
      if (cells.length < 5) {
        continue;
      }

      const postingUrl = choosePostingUrl(cells[3]);
      if (!postingUrl) {
        continue;
      }

      const job = parsedJob(SIMPLIFY_SOURCE_NAME, {
        company: cells[0],
        companyUrl: firstHref(cells[0]),
        title: cells[1],
        location: cells[2],
        salary: null,
        postingUrl,
        age: stripHtml(cells[4]),
        category,
        rawMarkdown: `<tr>${row}</tr>`
      });
      if (job) {
        jobs.push(job);
      }
    }
  }

  return jobs;
}

export function parseNewGradMarkdown(markdown: string): ParsedImportedJob[] {
  return parseSpeedyApplyMarkdown(markdown);
}

export const JOB_SOURCE_PROVIDERS: JobSourceProvider[] = [
  {
    id: SPEEDYAPPLY_SOURCE_NAME,
    name: "SpeedyApply 2026 SWE College Jobs",
    defaultUrl: DEFAULT_NEW_GRAD_JOBS_URL,
    sourceRepo: "speedyapply/2026-SWE-College-Jobs",
    parse: parseSpeedyApplyMarkdown
  },
  {
    id: SIMPLIFY_SOURCE_NAME,
    name: "Simplify New Grad Positions",
    defaultUrl: DEFAULT_SIMPLIFY_JOBS_URL,
    sourceRepo: "SimplifyJobs/New-Grad-Positions",
    parse: parseSimplifyMarkdown
  }
];

export function providerForId(providerId: string): JobSourceProvider | undefined {
  return JOB_SOURCE_PROVIDERS.find((provider) => provider.id === providerId);
}

export function importedJobDescription(
  job: Pick<ParsedImportedJob, "category" | "age" | "salary" | "rawMarkdown"> & {
    sourceRepo?: string | null;
    sourceName?: string | null;
    canonicalUrl?: string | null;
  }
): string {
  return [
    `Imported from ${job.sourceRepo ?? job.sourceName ?? "configured job source"}.`,
    `Category: ${job.category}`,
    job.salary ? `Salary: ${job.salary}` : null,
    job.age ? `Posting age at import: ${job.age}` : null,
    job.canonicalUrl ? `Canonical URL: ${job.canonicalUrl}` : null,
    "",
    "Original markdown row:",
    job.rawMarkdown
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
