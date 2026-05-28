import type {
  ApplicationDTO,
  ExperienceDTO,
  ImportedJobBatchDTO,
  ImportedJobDTO,
  JobPostingDTO,
  MatchAnalysisDTO,
  ProfileDTO,
  ResumeDTO,
  ResumeDraftDTO
} from "../shared/types";

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function stringifyArray(value: unknown): string {
  if (!value) {
    return "[]";
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value.map(String).filter(Boolean));
  }
  if (typeof value === "string") {
    return JSON.stringify(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }
  return "[]";
}

export function dateToString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toProfileDTO(profile: any): ProfileDTO {
  return {
    ...profile,
    targetRoles: parseJsonArray(profile.targetRoles),
    preferredLocations: parseJsonArray(profile.preferredLocations),
    skills: parseJsonArray(profile.skills),
    industries: parseJsonArray(profile.industries),
    createdAt: dateToString(profile.createdAt) ?? new Date().toISOString(),
    updatedAt: dateToString(profile.updatedAt) ?? new Date().toISOString()
  };
}

export function toJobDTO(job: any): JobPostingDTO {
  return {
    ...job,
    requirements: parseJsonArray(job.requirements),
    preferredQualifications: parseJsonArray(job.preferredQualifications),
    technologies: parseJsonArray(job.technologies),
    datePosted: dateToString(job.datePosted),
    dateFound: dateToString(job.dateFound) ?? new Date().toISOString(),
    createdAt: dateToString(job.createdAt) ?? new Date().toISOString(),
    updatedAt: dateToString(job.updatedAt) ?? new Date().toISOString()
  };
}

export function toResumeDTO(resume: any): ResumeDTO {
  return {
    ...resume,
    tags: parseJsonArray(resume.tags),
    fileType: resume.fileType === "docx" ? "docx" : "pdf",
    createdAt: dateToString(resume.createdAt) ?? new Date().toISOString(),
    updatedAt: dateToString(resume.updatedAt) ?? new Date().toISOString(),
    lastUsedAt: dateToString(resume.lastUsedAt)
  };
}

export function toApplicationDTO(application: any): ApplicationDTO {
  return {
    ...application,
    dateApplied: dateToString(application.dateApplied),
    createdAt: dateToString(application.createdAt) ?? new Date().toISOString(),
    updatedAt: dateToString(application.updatedAt) ?? new Date().toISOString(),
    jobPosting: application.jobPosting ? toJobDTO(application.jobPosting) : undefined,
    resume: application.resume ? toResumeDTO(application.resume) : null
  };
}

export function toExperienceDTO(experience: any): ExperienceDTO {
  return {
    ...experience,
    technologies: parseJsonArray(experience.technologies),
    bullets: parseJsonArray(experience.bullets),
    impactMetrics: parseJsonArray(experience.impactMetrics),
    tags: parseJsonArray(experience.tags),
    startDate: dateToString(experience.startDate),
    endDate: dateToString(experience.endDate),
    createdAt: dateToString(experience.createdAt) ?? new Date().toISOString(),
    updatedAt: dateToString(experience.updatedAt) ?? new Date().toISOString()
  };
}

export function toMatchDTO(match: any): MatchAnalysisDTO {
  return {
    ...match,
    strengths: parseJsonArray(match.strengths),
    weaknesses: parseJsonArray(match.weaknesses),
    missingSkills: parseJsonArray(match.missingSkills),
    relevantExperienceIds: parseJsonArray(match.relevantExperienceIds),
    suggestedChanges: parseJsonArray(match.suggestedChanges),
    interviewPrepTopics: parseJsonArray(match.interviewPrepTopics),
    createdAt: dateToString(match.createdAt) ?? new Date().toISOString()
  };
}

export function toDraftDTO(draft: any): ResumeDraftDTO {
  return {
    ...draft,
    format: "markdown",
    changeSummary: parseJsonArray(draft.changeSummary),
    createdAt: dateToString(draft.createdAt) ?? new Date().toISOString(),
    updatedAt: dateToString(draft.updatedAt) ?? new Date().toISOString(),
    baseResume: draft.baseResume ? toResumeDTO(draft.baseResume) : undefined,
    jobPosting: draft.jobPosting ? toJobDTO(draft.jobPosting) : undefined
  };
}

export function toImportedJobDTO(job: any): ImportedJobDTO {
  return {
    ...job,
    status: job.status,
    importedAt: dateToString(job.importedAt) ?? new Date().toISOString(),
    lastSeenAt: dateToString(job.lastSeenAt) ?? new Date().toISOString()
  };
}

export function toImportedBatchDTO(batch: any): ImportedJobBatchDTO {
  return {
    ...batch,
    fetchedAt: dateToString(batch.fetchedAt) ?? new Date().toISOString(),
    errors: parseJsonArray(batch.errors)
  };
}
