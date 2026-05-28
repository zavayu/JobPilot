import crypto from "node:crypto";

export const DEFAULT_NEW_GRAD_JOBS_URL =
  "https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/NEW_GRAD_USA.md";

export type ParsedImportedJob = {
  sourceKey: string;
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

function firstHref(value: string): string | null {
  const match = value.match(/href="([^"]+)"/i);
  return match?.[1] ?? null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function sourceKeyFor(company: string, title: string, location: string | null | undefined, postingUrl: string): string {
  const normalized = [postingUrl, company, title, location ?? ""].join("|").toLowerCase();
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function categoryFromMarker(line: string, current: string): string {
  if (line.includes("TABLE_FAANG_START")) return "FAANG+";
  if (line.includes("TABLE_QUANT_START")) return "Quant";
  if (line.includes("TABLE_START")) return "Other";
  return current;
}

export function parseNewGradMarkdown(markdown: string): ParsedImportedJob[] {
  const jobs: ParsedImportedJob[] = [];
  let category = "";

  for (const line of markdown.split(/\r?\n/)) {
    category = categoryFromMarker(line, category);
    const cells = splitMarkdownRow(line);
    if (cells.length < 5 || cells[0] === "---" || cells[0].toLowerCase() === "company") {
      continue;
    }

    const hasSalary = cells.length >= 6;
    const companyCell = cells[0];
    const titleCell = cells[1];
    const locationCell = cells[2];
    const salaryCell = hasSalary ? cells[3] : null;
    const postingCell = hasSalary ? cells[4] : cells[3];
    const ageCell = hasSalary ? cells[5] : cells[4];

    const company = stripHtml(companyCell);
    const title = stripHtml(titleCell);
    const location = stripHtml(locationCell);
    const salary = salaryCell ? stripHtml(salaryCell) : null;
    const postingUrl = firstHref(postingCell);
    const companyUrl = firstHref(companyCell);
    const age = stripHtml(ageCell);

    if (!company || !title || !postingUrl) {
      continue;
    }

    jobs.push({
      sourceKey: sourceKeyFor(company, title, location, postingUrl),
      company,
      companyUrl,
      title,
      location,
      salary,
      postingUrl,
      age,
      category: category || "Other",
      rawMarkdown: line
    });
  }

  return jobs;
}

export function importedJobDescription(job: Pick<ParsedImportedJob, "category" | "age" | "salary" | "rawMarkdown">): string {
  return [
    "Imported from speedyapply/2026-SWE-College-Jobs NEW_GRAD_USA.md.",
    `Category: ${job.category}`,
    job.salary ? `Salary: ${job.salary}` : null,
    job.age ? `Posting age at import: ${job.age}` : null,
    "",
    "Original markdown row:",
    job.rawMarkdown
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
