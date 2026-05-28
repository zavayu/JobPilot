import type { PrismaClient as PrismaClientType } from "@prisma/client";
import {
  JobImportSourceConfig,
  importedJobDescription,
  providerForId
} from "./jobImportParser";
import { getPrisma } from "./database";
import { stringifyArray, toApplicationDTO, toImportedBatchDTO, toImportedJobDTO } from "./serializers";
import { getSettings, updateSettings } from "./services";

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

function enabledSources(sources: JobImportSourceConfig[], sourceId?: string | null): JobImportSourceConfig[] {
  return sources.filter((source) => source.enabled && (!sourceId || source.id === sourceId));
}

export async function syncImportedJobs(sourceId?: string | null) {
  const prisma = await getPrisma();
  const settings = await getSettings();
  const batches = [];

  for (const source of enabledSources(settings.jobImportSources, sourceId)) {
    const provider = providerForId(source.provider);
    const errors: string[] = [];
    let totalFound = 0;
    let newJobs = 0;
    let updatedJobs = 0;
    let duplicateJobs = 0;

    if (!provider) {
      errors.push(`Unknown job source provider: ${source.provider}`);
    } else {
      try {
        const markdown = await fetchText(source.url);
        const parsedJobs = provider.parse(markdown);
        totalFound = parsedJobs.length;
        const seenInBatch = new Set<string>();

        await prisma.$transaction(async (tx) => {
          for (const job of parsedJobs) {
            if (seenInBatch.has(job.sourceKey) || seenInBatch.has(job.canonicalUrl)) {
              duplicateJobs += 1;
              continue;
            }
            seenInBatch.add(job.sourceKey);
            seenInBatch.add(job.canonicalUrl);

            const existingBySource = await tx.importedJob.findUnique({ where: { sourceKey: job.sourceKey } });
            if (existingBySource) {
              updatedJobs += 1;
              await tx.importedJob.update({
                where: { sourceKey: job.sourceKey },
                data: {
                  company: job.company,
                  companyUrl: job.companyUrl,
                  title: job.title,
                  location: job.location,
                  salary: job.salary,
                  postingUrl: job.canonicalUrl,
                  age: job.age,
                  category: job.category,
                  sourceName: source.id,
                  sourceUrl: source.url,
                  sourceRepo: provider.sourceRepo,
                  rawMarkdown: job.rawMarkdown,
                  lastSeenAt: new Date()
                }
              });
              continue;
            }

            const duplicate = await tx.importedJob.findFirst({
              where: {
                postingUrl: job.canonicalUrl
              },
              orderBy: { importedAt: "asc" }
            });
            if (duplicate) {
              duplicateJobs += 1;
              await tx.importedJob.create({
                data: {
                  id: crypto.randomUUID(),
                  sourceKey: job.sourceKey,
                  company: job.company,
                  companyUrl: job.companyUrl,
                  title: job.title,
                  location: job.location,
                  salary: job.salary,
                  postingUrl: job.canonicalUrl,
                  age: job.age,
                  category: job.category,
                  rawMarkdown: job.rawMarkdown,
                  status: "ignored",
                  sourceName: source.id,
                  sourceUrl: source.url,
                  sourceRepo: provider.sourceRepo
                }
              });
            } else {
              newJobs += 1;
              await tx.importedJob.create({
                data: {
                  id: crypto.randomUUID(),
                  sourceKey: job.sourceKey,
                  company: job.company,
                  companyUrl: job.companyUrl,
                  title: job.title,
                  location: job.location,
                  salary: job.salary,
                  postingUrl: job.canonicalUrl,
                  age: job.age,
                  category: job.category,
                  rawMarkdown: job.rawMarkdown,
                  sourceName: source.id,
                  sourceUrl: source.url,
                  sourceRepo: provider.sourceRepo
                }
              });
            }
          }
        });
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    const batch = await prisma.importedJobBatch.create({
      data: {
        id: crypto.randomUUID(),
        sourceName: source.id,
        sourceUrl: source.url,
        totalFound,
        newJobs,
        updatedJobs,
        duplicateJobs,
        errors: stringifyArray(errors)
      }
    });
    batches.push(toImportedBatchDTO(batch));
  }

  if (batches.length) {
    await updateSettings({ lastJobImportAt: new Date().toISOString() });
  }

  const recentJobs = await prisma.importedJob.findMany({
    where: {
      status: "new"
    },
    orderBy: [{ lastSeenAt: "desc" }, { importedAt: "desc" }],
    take: 50
  });

  return {
    batches,
    recentJobs: recentJobs.map(toImportedJobDTO)
  };
}

export async function listImportedJobs(status: "all" | "new" | "saved" | "ignored" = "new", sourceId: string | "all" = "all") {
  const prisma = await getPrisma();
  const where: Record<string, unknown> = {};
  if (status !== "all") {
    where.status = status;
  }
  if (sourceId !== "all") {
    where.sourceName = sourceId;
  }
  const jobs = await prisma.importedJob.findMany({
    where,
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

async function saveImportedJobInTransaction(
  tx: Omit<PrismaClientType, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  importedJobId: string
) {
  const importedJob = await tx.importedJob.findUniqueOrThrow({ where: { id: importedJobId } });
  const duplicate = await tx.importedJob.findFirst({
    where: {
      postingUrl: importedJob.postingUrl,
      savedJobId: { not: null }
    },
    orderBy: { importedAt: "asc" }
  });

  if (duplicate?.savedJobId) {
    await tx.importedJob.update({
      where: { id: importedJobId },
      data: {
        status: "saved",
        savedJobId: duplicate.savedJobId
      }
    });
    return tx.application.findFirstOrThrow({
      where: { jobPostingId: duplicate.savedJobId },
      include: { jobPosting: true, resume: true }
    });
  }

  const job = await tx.jobPosting.create({
    data: {
      id: crypto.randomUUID(),
      company: importedJob.company,
      title: importedJob.title,
      location: importedJob.location,
      description: importedJobDescription({
        ...importedJob,
        canonicalUrl: importedJob.postingUrl
      }),
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
      notes: `Imported from ${importedJob.sourceRepo ?? importedJob.sourceName ?? "GitHub"} (${importedJob.category}).`
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
