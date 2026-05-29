import { dialog } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import {
  CreateJobInput,
  DashboardMetrics,
  JobDetailDTO,
  SettingsDTO,
  UpdateApplicationInput,
  UpsertExperienceInput,
  UpsertProfileInput
} from "../shared/types";
import { getPrisma } from "./database";
import { getLocalDataPaths } from "./localData";
import { extractResumeText } from "./resumeText";
import { DEFAULT_NEW_GRAD_JOBS_URL, JobImportSourceConfig, defaultJobImportSources } from "./jobImportParser";
import {
  parseJsonArray,
  stringifyArray,
  toApplicationDTO,
  toDraftDTO,
  toExperienceDTO,
  toJobDTO,
  toMatchDTO,
  toProfileDTO,
  toResumeDTO
} from "./serializers";

function nowDate(): Date {
  return new Date();
}

function cleanOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function getProfile() {
  const prisma = await getPrisma();
  const existing = await prisma.profile.findFirst();
  if (existing) {
    return toProfileDTO(existing);
  }
  const created = await prisma.profile.create({
    data: {
      id: crypto.randomUUID(),
      name: "",
      targetRoles: "[]",
      preferredLocations: "[]",
      skills: "[]",
      industries: "[]"
    }
  });
  return toProfileDTO(created);
}

export async function updateProfile(input: UpsertProfileInput) {
  const prisma = await getPrisma();
  const profile = await getProfile();
  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: {
      name: input.name ?? profile.name,
      email: cleanOptional(input.email ?? profile.email ?? undefined),
      targetRoles: stringifyArray(input.targetRoles ?? profile.targetRoles),
      preferredLocations: stringifyArray(input.preferredLocations ?? profile.preferredLocations),
      remotePreference: cleanOptional(input.remotePreference ?? profile.remotePreference ?? undefined),
      workAuthorization: cleanOptional(input.workAuthorization ?? profile.workAuthorization ?? undefined),
      skills: stringifyArray(input.skills ?? profile.skills),
      industries: stringifyArray(input.industries ?? profile.industries),
      summary: cleanOptional(input.summary ?? profile.summary ?? undefined),
      updatedAt: nowDate()
    }
  });
  return toProfileDTO(updated);
}

export async function listApplications() {
  const prisma = await getPrisma();
  const applications = await prisma.application.findMany({
    include: { jobPosting: true, resume: true },
    orderBy: { updatedAt: "desc" }
  });
  return applications.map(toApplicationDTO);
}

export async function createJob(input: CreateJobInput) {
  const prisma = await getPrisma();
  const application = await prisma.$transaction(async (tx) => {
    const job = await tx.jobPosting.create({
      data: {
        id: crypto.randomUUID(),
        company: input.company.trim(),
        title: input.title.trim(),
        location: cleanOptional(input.location),
        remoteType: cleanOptional(input.remoteType),
        sourceUrl: cleanOptional(input.sourceUrl),
        description: input.description.trim(),
        employmentType: cleanOptional(input.employmentType),
        source: "manual"
      }
    });
    const created = await tx.application.create({
      data: {
        id: crypto.randomUUID(),
        jobPostingId: job.id,
        status: input.status || "Interested",
        notes: cleanOptional(input.notes)
      },
      include: { jobPosting: true, resume: true }
    });
    await tx.statusHistory.create({
      data: {
        id: crypto.randomUUID(),
        applicationId: created.id,
        toStatus: created.status,
        note: "Application created"
      }
    });
    return created;
  });
  return toApplicationDTO(application);
}

export async function getJobDetail(jobPostingId: string): Promise<JobDetailDTO> {
  const prisma = await getPrisma();
  const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } });
  const application = await prisma.application.findFirst({
    where: { jobPostingId },
    include: { jobPosting: true, resume: true }
  });
  const matches = await prisma.matchAnalysis.findMany({
    where: { jobPostingId },
    orderBy: { createdAt: "desc" }
  });
  const drafts = await prisma.resumeDraft.findMany({
    where: { jobPostingId },
    include: { baseResume: true, jobPosting: true },
    orderBy: { updatedAt: "desc" }
  });
  return {
    job: toJobDTO(job),
    application: application ? toApplicationDTO(application) : null,
    matches: matches.map(toMatchDTO),
    drafts: drafts.map(toDraftDTO)
  };
}

export async function deleteJob(jobPostingId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.jobPosting.delete({ where: { id: jobPostingId } });
}

export async function updateApplication(applicationId: string, input: UpdateApplicationInput) {
  const prisma = await getPrisma();
  const existing = await prisma.application.findUniqueOrThrow({ where: { id: applicationId } });
  const nextStatus = input.status ?? existing.status;
  const updated = await prisma.$transaction(async (tx) => {
    const application = await tx.application.update({
      where: { id: applicationId },
      data: {
        status: nextStatus,
        resumeId: input.resumeId === undefined ? existing.resumeId : input.resumeId,
        dateApplied: input.dateApplied === undefined || input.dateApplied === null ? existing.dateApplied : new Date(input.dateApplied),
        notes: input.notes === undefined ? existing.notes : input.notes,
        priority: input.priority === undefined ? existing.priority : input.priority,
        updatedAt: nowDate()
      },
      include: { jobPosting: true, resume: true }
    });

    if (nextStatus !== existing.status) {
      await tx.statusHistory.create({
        data: {
          id: crypto.randomUUID(),
          applicationId,
          fromStatus: existing.status,
          toStatus: nextStatus,
          note: input.notes ?? undefined
        }
      });
    }

    if (application.resumeId) {
      await tx.resume.update({
        where: { id: application.resumeId },
        data: { lastUsedAt: nowDate() }
      });
    }

    return application;
  });
  return toApplicationDTO(updated);
}

export async function importResume() {
  const result = await dialog.showOpenDialog({
    title: "Import resume",
    properties: ["openFile"],
    filters: [{ name: "Resume files", extensions: ["pdf", "docx"] }]
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const sourcePath = result.filePaths[0];
  const ext = path.extname(sourcePath).toLowerCase();
  if (ext !== ".pdf" && ext !== ".docx") {
    throw new Error("Only PDF and DOCX resumes are supported.");
  }

  const paths = getLocalDataPaths();
  const fileType = ext === ".docx" ? "docx" : "pdf";
  const originalFileName = path.basename(sourcePath);
  const storedName = `${Date.now()}-${originalFileName.replace(/[^\w.-]/g, "_")}`;
  const destinationPath = path.join(paths.resumesOriginalDir, storedName);

  await fs.copyFile(sourcePath, destinationPath);
  const extractedText = await extractResumeText(destinationPath, fileType);
  const extractedPath = path.join(paths.resumesExtractedDir, `${storedName}.txt`);
  await fs.writeFile(extractedPath, extractedText, "utf8");

  const prisma = await getPrisma();
  const resume = await prisma.resume.create({
    data: {
      id: crypto.randomUUID(),
      title: originalFileName.replace(ext, ""),
      originalFileName,
      fileType,
      filePath: destinationPath,
      extractedText
    }
  });
  return toResumeDTO(resume);
}

export async function listResumes() {
  const prisma = await getPrisma();
  const resumes = await prisma.resume.findMany({ orderBy: { updatedAt: "desc" } });
  return resumes.map(toResumeDTO);
}

export async function previewResume(resumeId: string) {
  const prisma = await getPrisma();
  const resume = await prisma.resume.findUniqueOrThrow({ where: { id: resumeId } });
  if (resume.fileType !== "pdf") {
    return {
      resumeId,
      fileType: resume.fileType === "docx" ? "docx" : "pdf",
      dataUrl: null
    };
  }

  const buffer = await fs.readFile(resume.filePath);
  return {
    resumeId,
    fileType: "pdf",
    dataUrl: `data:application/pdf;base64,${buffer.toString("base64")}`
  };
}

export async function updateResume(resumeId: string, input: any) {
  const prisma = await getPrisma();
  const updated = await prisma.resume.update({
    where: { id: resumeId },
    data: {
      title: input.title,
      targetRole: cleanOptional(input.targetRole),
      tags: stringifyArray(input.tags),
      notes: cleanOptional(input.notes),
      updatedAt: nowDate()
    }
  });
  return toResumeDTO(updated);
}

export async function deleteResume(resumeId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.resume.delete({ where: { id: resumeId } });
}

export async function listExperiences() {
  const prisma = await getPrisma();
  const experiences = await prisma.experience.findMany({ orderBy: { updatedAt: "desc" } });
  return experiences.map(toExperienceDTO);
}

function experienceData(input: UpsertExperienceInput) {
  return {
    title: input.title.trim(),
    organization: cleanOptional(input.organization),
    startDate: input.startDate ? new Date(input.startDate) : null,
    endDate: input.endDate ? new Date(input.endDate) : null,
    description: cleanOptional(input.description),
    technologies: stringifyArray(input.technologies),
    bullets: stringifyArray(input.bullets),
    impactMetrics: stringifyArray(input.impactMetrics),
    tags: stringifyArray(input.tags),
    updatedAt: nowDate()
  };
}

export async function createExperience(input: UpsertExperienceInput) {
  const prisma = await getPrisma();
  const created = await prisma.experience.create({
    data: {
      id: crypto.randomUUID(),
      ...experienceData(input)
    }
  });
  return toExperienceDTO(created);
}

export async function updateExperience(experienceId: string, input: UpsertExperienceInput) {
  const prisma = await getPrisma();
  const updated = await prisma.experience.update({
    where: { id: experienceId },
    data: experienceData(input)
  });
  return toExperienceDTO(updated);
}

export async function deleteExperience(experienceId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.experience.delete({ where: { id: experienceId } });
}

export async function getSettings(): Promise<SettingsDTO> {
  const prisma = await getPrisma();
  const settings = await prisma.setting.findMany();
  const values = new Map(settings.map((setting) => [setting.key, setting.value]));
  const legacyUrl = values.get("jobImportUrl") ?? DEFAULT_NEW_GRAD_JOBS_URL;
  let jobImportSources: JobImportSourceConfig[] = defaultJobImportSources();
  const storedSources = values.get("jobImportSources");
  if (storedSources) {
    try {
      const parsed = JSON.parse(storedSources);
      if (Array.isArray(parsed)) {
        const defaults = new Map(jobImportSources.map((source) => [source.id, source]));
        jobImportSources = parsed
          .map((source) => {
            if (!source || typeof source !== "object") return null;
            const fallback = defaults.get(String(source.id)) ?? null;
            return {
              id: String(source.id ?? fallback?.id ?? ""),
              name: String(source.name ?? fallback?.name ?? ""),
              provider: String(source.provider ?? fallback?.provider ?? source.id ?? ""),
              url: String(source.url ?? fallback?.url ?? ""),
              enabled: source.enabled !== false
            };
          })
          .filter((source): source is JobImportSourceConfig => Boolean(source?.id && source.url));
      }
    } catch {
      jobImportSources = defaultJobImportSources();
    }
  } else {
    jobImportSources = jobImportSources.map((source) => (source.id === "speedyapply_new_grad_usa" ? { ...source, url: legacyUrl } : source));
  }
  return {
    openAiApiKeySet: Boolean(values.get("openAiApiKey")),
    openAiApiKey: values.get("openAiApiKey") ?? "",
    openAiModel: values.get("openAiModel") ?? "gpt-4.1-mini",
    theme: values.get("theme") === "light" ? "light" : "dark",
    dataDirectory: getLocalDataPaths().dataDir,
    jobImportUrl: legacyUrl,
    jobImportSources,
    jobAutoSyncEnabled: values.get("jobAutoSyncEnabled") !== "false",
    jobAutoSyncIntervalHours: Number(values.get("jobAutoSyncIntervalHours") ?? "6") || 6,
    lastJobImportAt: values.get("lastJobImportAt") ?? null
  };
}

export async function updateSettings(
  input: Partial<
    Pick<
      SettingsDTO,
      | "openAiApiKey"
      | "openAiModel"
      | "theme"
      | "jobImportUrl"
      | "jobImportSources"
      | "jobAutoSyncEnabled"
      | "jobAutoSyncIntervalHours"
      | "lastJobImportAt"
    >
  >
) {
  const prisma = await getPrisma();
  const settingEntries: Array<[string, string]> = [];
  if (input.openAiApiKey !== undefined) {
    settingEntries.push(["openAiApiKey", input.openAiApiKey]);
  }
  if (input.openAiModel !== undefined) {
    settingEntries.push(["openAiModel", input.openAiModel]);
  }
  if (input.theme !== undefined) {
    settingEntries.push(["theme", input.theme]);
  }
  if (input.jobImportUrl !== undefined) {
    settingEntries.push(["jobImportUrl", input.jobImportUrl]);
  }
  if (input.jobImportSources !== undefined) {
    settingEntries.push(["jobImportSources", JSON.stringify(input.jobImportSources)]);
  }
  if (input.jobAutoSyncEnabled !== undefined) {
    settingEntries.push(["jobAutoSyncEnabled", String(input.jobAutoSyncEnabled)]);
  }
  if (input.jobAutoSyncIntervalHours !== undefined) {
    settingEntries.push(["jobAutoSyncIntervalHours", String(Math.max(1, input.jobAutoSyncIntervalHours))]);
  }
  if (input.lastJobImportAt !== undefined) {
    settingEntries.push(["lastJobImportAt", input.lastJobImportAt ?? ""]);
  }

  for (const [key, value] of settingEntries) {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value, updatedAt: nowDate() }
    });
  }
  return getSettings();
}

export async function listDrafts() {
  const prisma = await getPrisma();
  const drafts = await prisma.resumeDraft.findMany({
    include: { baseResume: true, jobPosting: true },
    orderBy: { updatedAt: "desc" }
  });
  return drafts.map(toDraftDTO);
}

export async function exportMarkdownDraft(draftId: string): Promise<string> {
  const prisma = await getPrisma();
  const draft = await prisma.resumeDraft.findUniqueOrThrow({ where: { id: draftId } });
  const paths = getLocalDataPaths();
  const fileName = `${draft.title.replace(/[^\w.-]/g, "_") || "resume-draft"}.md`;
  const destinationPath = path.join(paths.exportsDir, fileName);
  await fs.writeFile(destinationPath, draft.content, "utf8");
  const updated = await prisma.resumeDraft.update({
    where: { id: draftId },
    data: { filePath: destinationPath, updatedAt: nowDate() }
  });
  return updated.filePath ?? destinationPath;
}

export async function getAnalytics(): Promise<DashboardMetrics> {
  const [applications, resumes, experiences] = await Promise.all([listApplications(), listResumes(), listExperiences()]);
  const totalJobs = applications.length;
  const byStatusMap = new Map<string, number>();
  for (const app of applications) {
    byStatusMap.set(app.status, (byStatusMap.get(app.status) ?? 0) + 1);
  }
  const activeApplications = applications.filter((app) => !["Interested", "Withdrawn"].includes(app.status));
  const responses = applications.filter((app) =>
    ["Online Assessment", "Recruiter Screen", "Technical Interview", "Final Interview", "Offer"].includes(app.status)
  );
  const interviews = applications.filter((app) => ["Technical Interview", "Final Interview", "Offer"].includes(app.status));
  const offers = applications.filter((app) => app.status === "Offer");

  return {
    totalJobs,
    totalApplications: activeApplications.length,
    totalResumes: resumes.length,
    totalExperiences: experiences.length,
    byStatus: Array.from(byStatusMap.entries()).map(([status, count]) => ({ status, count })),
    recentApplications: applications.slice(0, 6),
    responseRate: activeApplications.length ? Math.round((responses.length / activeApplications.length) * 100) : 0,
    interviewRate: activeApplications.length ? Math.round((interviews.length / activeApplications.length) * 100) : 0,
    offerRate: activeApplications.length ? Math.round((offers.length / activeApplications.length) * 100) : 0
  };
}

export function arrayFromText(value: string): string[] {
  return parseJsonArray(value);
}
