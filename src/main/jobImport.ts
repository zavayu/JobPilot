import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { DEFAULT_NEW_GRAD_JOBS_URL, importedJobDescription, parseNewGradMarkdown } from "./jobImportParser";
import { getPrisma } from "./database";
import { stringifyArray, toApplicationDTO, toImportedBatchDTO, toImportedJobDTO } from "./serializers";
import { getSettings, updateSettings } from "./services";

export const SPEEDYAPPLY_SOURCE_NAME = "speedyapply_new_grad_usa";
export const SPEEDYAPPLY_REPO = "speedyapply/2026-SWE-College-Jobs";

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/plain, text/markdown;q=0.9, */*;q=0.1",
      "User-Agent": "JobPilot local desktop app"
    }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch jobs from ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function syncImportedJobs() {
  const prisma = await getPrisma();
  const settings = await getSettings();
  const sourceUrl = settings.jobImportUrl || DEFAULT_NEW_GRAD_JOBS_URL;
  const errors: string[] = [];
  let totalFound = 0;
  let newJobs = 0;
  let updatedJobs = 0;
  let duplicateJobs = 0;

  try {
    const markdown = await fetchText(sourceUrl);
    const parsedJobs = parseNewGradMarkdown(markdown);
    totalFound = parsedJobs.length;
    const seenInBatch = new Set<string>();

    await prisma.$transaction(async (tx) => {
      for (const job of parsedJobs) {
        if (seenInBatch.has(job.sourceKey)) {
          duplicateJobs += 1;
          continue;
        }
        seenInBatch.add(job.sourceKey);

        const existing = await tx.importedJob.findUnique({ where: { sourceKey: job.sourceKey } });
        if (existing) {
          updatedJobs += 1;
          await tx.importedJob.update({
            where: { sourceKey: job.sourceKey },
            data: {
              company: job.company,
              companyUrl: job.companyUrl,
              title: job.title,
              location: job.location,
              salary: job.salary,
              postingUrl: job.postingUrl,
              age: job.age,
              category: job.category,
              sourceUrl,
              sourceRepo: SPEEDYAPPLY_REPO,
              rawMarkdown: job.rawMarkdown,
              lastSeenAt: new Date()
            }
          });
        } else {
          newJobs += 1;
          await tx.importedJob.create({
            data: {
              id: crypto.randomUUID(),
              ...job,
              sourceName: SPEEDYAPPLY_SOURCE_NAME,
              sourceUrl,
              sourceRepo: SPEEDYAPPLY_REPO
            }
          });
        }
      }
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const batch = await prisma.importedJobBatch.create({
    data: {
      id: crypto.randomUUID(),
      sourceName: SPEEDYAPPLY_SOURCE_NAME,
      sourceUrl,
      totalFound,
      newJobs,
      updatedJobs,
      duplicateJobs,
      errors: stringifyArray(errors)
    }
  });

  await updateSettings({ lastJobImportAt: batch.fetchedAt.toISOString() });

  const recentJobs = await prisma.importedJob.findMany({
    where: { status: "new" },
    orderBy: [{ lastSeenAt: "desc" }, { importedAt: "desc" }],
    take: 50
  });

  return {
    batch: toImportedBatchDTO(batch),
    recentJobs: recentJobs.map(toImportedJobDTO)
  };
}

export async function listImportedJobs(status: "all" | "new" | "saved" | "ignored" = "new") {
  const prisma = await getPrisma();
  const jobs = await prisma.importedJob.findMany({
    where: status === "all" ? undefined : { status },
    orderBy: [{ lastSeenAt: "desc" }, { importedAt: "desc" }],
    take: 500
  });
  return jobs.map(toImportedJobDTO);
}

export async function ignoreImportedJob(importedJobId: string) {
  const prisma = await getPrisma();
  const updated = await prisma.importedJob.update({
    where: { id: importedJobId },
    data: { status: "ignored" }
  });
  return toImportedJobDTO(updated);
}

export async function saveImportedJob(importedJobId: string) {
  const prisma = await getPrisma();
  const importedJob = await prisma.importedJob.findUniqueOrThrow({ where: { id: importedJobId } });

  if (importedJob.savedJobId) {
    const existingApplication = await prisma.application.findFirstOrThrow({
      where: { jobPostingId: importedJob.savedJobId },
      include: { jobPosting: true, resume: true }
    });
    return toApplicationDTO(existingApplication);
  }

  const application = await prisma.$transaction((tx) => saveImportedJobInTransaction(tx, importedJob.id));
  return toApplicationDTO(application);
}

async function saveImportedJobInTransaction(tx: Omit<PrismaClientType, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">, importedJobId: string) {
  const importedJob = await tx.importedJob.findUniqueOrThrow({ where: { id: importedJobId } });
  const job = await tx.jobPosting.create({
    data: {
      id: crypto.randomUUID(),
      company: importedJob.company,
      title: importedJob.title,
      location: importedJob.location,
      description: importedJobDescription(importedJob),
      source: "github_import",
      sourceUrl: importedJob.postingUrl,
      sourceRepo: importedJob.sourceRepo,
      sourceCommit: importedJob.sourceCommit,
      employmentType: "New Grad",
      requirements: "[]",
      preferredQualifications: "[]",
      technologies: "[]"
    }
  });
  const application = await tx.application.create({
    data: {
      id: crypto.randomUUID(),
      jobPostingId: job.id,
      status: "Interested",
      notes: `Imported from ${importedJob.sourceRepo ?? "GitHub"} (${importedJob.category}).`
    },
    include: { jobPosting: true, resume: true }
  });
  await tx.statusHistory.create({
    data: {
      id: crypto.randomUUID(),
      applicationId: application.id,
      toStatus: "Interested",
      note: "Saved from imported job queue"
    }
  });
  await tx.importedJob.update({
    where: { id: importedJobId },
    data: {
      status: "saved",
      savedJobId: job.id
    }
  });
  return application;
}

let autoSyncTimer: NodeJS.Timeout | null = null;
let autoSyncRunning = false;

export async function runAutoJobImport(reason: "startup" | "interval"): Promise<void> {
  const settings = await getSettings();
  if (!settings.jobAutoSyncEnabled) {
    return;
  }

  const intervalMs = Math.max(1, settings.jobAutoSyncIntervalHours) * 60 * 60 * 1000;
  const lastImportAt = settings.lastJobImportAt ? new Date(settings.lastJobImportAt).getTime() : 0;
  if (reason === "startup" && Date.now() - lastImportAt < intervalMs) {
    return;
  }
  if (autoSyncRunning) {
    return;
  }

  autoSyncRunning = true;
  try {
    await syncImportedJobs();
  } finally {
    autoSyncRunning = false;
  }
}

export function scheduleAutoJobImport(): void {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
  }
  autoSyncTimer = setInterval(
    () => {
      void runAutoJobImport("interval").catch((error) => {
        console.error("Auto job import failed", error);
      });
    },
    60 * 60 * 1000
  );
  void runAutoJobImport("startup").catch((error) => {
    console.error("Startup job import failed", error);
  });
}
