import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { ensureLocalDataDirs, toPrismaSqliteUrl } from "./localData";

let prisma: PrismaClientType | null = null;

export async function getPrisma(): Promise<PrismaClientType> {
  if (prisma) {
    return prisma;
  }

  const paths = await ensureLocalDataDirs();
  process.env.DATABASE_URL = toPrismaSqliteUrl(paths.dbPath);

  const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
  prisma = new PrismaClient();
  await initializeSchema(prisma);
  return prisma;
}

async function initializeSchema(client: PrismaClientType): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "Profile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL DEFAULT '',
      "email" TEXT,
      "targetRoles" TEXT NOT NULL DEFAULT '[]',
      "preferredLocations" TEXT NOT NULL DEFAULT '[]',
      "remotePreference" TEXT,
      "workAuthorization" TEXT,
      "skills" TEXT NOT NULL DEFAULT '[]',
      "industries" TEXT NOT NULL DEFAULT '[]',
      "summary" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "JobPosting" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "company" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "location" TEXT,
      "remoteType" TEXT,
      "description" TEXT NOT NULL,
      "requirements" TEXT NOT NULL DEFAULT '[]',
      "preferredQualifications" TEXT NOT NULL DEFAULT '[]',
      "technologies" TEXT NOT NULL DEFAULT '[]',
      "source" TEXT NOT NULL DEFAULT 'manual',
      "sourceUrl" TEXT,
      "sourceRepo" TEXT,
      "sourceCommit" TEXT,
      "datePosted" DATETIME,
      "dateFound" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "employmentType" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Resume" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "targetRole" TEXT,
      "tags" TEXT NOT NULL DEFAULT '[]',
      "filePath" TEXT NOT NULL,
      "originalFileName" TEXT NOT NULL,
      "fileType" TEXT NOT NULL,
      "extractedText" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastUsedAt" DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS "Application" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "jobPostingId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'Interested',
      "resumeId" TEXT,
      "dateApplied" DATETIME,
      "notes" TEXT,
      "matchScore" INTEGER,
      "priority" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Application_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Application_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "StatusHistory" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "applicationId" TEXT NOT NULL,
      "fromStatus" TEXT,
      "toStatus" TEXT NOT NULL,
      "note" TEXT,
      "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Experience" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "title" TEXT NOT NULL,
      "organization" TEXT,
      "startDate" DATETIME,
      "endDate" DATETIME,
      "description" TEXT,
      "technologies" TEXT NOT NULL DEFAULT '[]',
      "bullets" TEXT NOT NULL DEFAULT '[]',
      "impactMetrics" TEXT NOT NULL DEFAULT '[]',
      "tags" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "MatchAnalysis" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "jobPostingId" TEXT NOT NULL,
      "resumeId" TEXT,
      "score" INTEGER NOT NULL,
      "strengths" TEXT NOT NULL DEFAULT '[]',
      "weaknesses" TEXT NOT NULL DEFAULT '[]',
      "missingSkills" TEXT NOT NULL DEFAULT '[]',
      "relevantExperienceIds" TEXT NOT NULL DEFAULT '[]',
      "recommendedResumeId" TEXT,
      "suggestedChanges" TEXT NOT NULL DEFAULT '[]',
      "applicationPriority" TEXT,
      "interviewPrepTopics" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "MatchAnalysis_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "MatchAnalysis_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "ResumeDraft" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "baseResumeId" TEXT NOT NULL,
      "jobPostingId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "content" TEXT NOT NULL,
      "format" TEXT NOT NULL DEFAULT 'markdown',
      "filePath" TEXT,
      "changeSummary" TEXT NOT NULL DEFAULT '[]',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ResumeDraft_baseResumeId_fkey" FOREIGN KEY ("baseResumeId") REFERENCES "Resume" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ResumeDraft_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "Setting" (
      "key" TEXT NOT NULL PRIMARY KEY,
      "value" TEXT NOT NULL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ImportedJob" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sourceKey" TEXT NOT NULL,
      "company" TEXT NOT NULL,
      "companyUrl" TEXT,
      "title" TEXT NOT NULL,
      "location" TEXT,
      "salary" TEXT,
      "postingUrl" TEXT NOT NULL,
      "age" TEXT,
      "category" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'new',
      "sourceName" TEXT NOT NULL DEFAULT 'speedyapply_new_grad_usa',
      "sourceUrl" TEXT NOT NULL,
      "sourceRepo" TEXT,
      "sourceCommit" TEXT,
      "rawMarkdown" TEXT NOT NULL,
      "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "savedJobId" TEXT,
      CONSTRAINT "ImportedJob_savedJobId_fkey" FOREIGN KEY ("savedJobId") REFERENCES "JobPosting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS "ImportedJobBatch" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sourceName" TEXT NOT NULL DEFAULT 'speedyapply_new_grad_usa',
      "sourceUrl" TEXT NOT NULL,
      "sourceCommit" TEXT,
      "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "totalFound" INTEGER NOT NULL,
      "newJobs" INTEGER NOT NULL,
      "updatedJobs" INTEGER NOT NULL,
      "duplicateJobs" INTEGER NOT NULL,
      "errors" TEXT NOT NULL DEFAULT '[]'
    )`,
    `CREATE INDEX IF NOT EXISTS "Application_jobPostingId_idx" ON "Application"("jobPostingId")`,
    `CREATE INDEX IF NOT EXISTS "Application_resumeId_idx" ON "Application"("resumeId")`,
    `CREATE INDEX IF NOT EXISTS "StatusHistory_applicationId_idx" ON "StatusHistory"("applicationId")`,
    `CREATE INDEX IF NOT EXISTS "MatchAnalysis_jobPostingId_idx" ON "MatchAnalysis"("jobPostingId")`,
    `CREATE INDEX IF NOT EXISTS "ResumeDraft_jobPostingId_idx" ON "ResumeDraft"("jobPostingId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ImportedJob_sourceKey_key" ON "ImportedJob"("sourceKey")`,
    `CREATE INDEX IF NOT EXISTS "ImportedJob_status_idx" ON "ImportedJob"("status")`,
    `CREATE INDEX IF NOT EXISTS "ImportedJob_savedJobId_idx" ON "ImportedJob"("savedJobId")`,
    `CREATE INDEX IF NOT EXISTS "ImportedJobBatch_fetchedAt_idx" ON "ImportedJobBatch"("fetchedAt")`
  ];

  for (const statement of statements) {
    await client.$executeRawUnsafe(statement);
  }
}
