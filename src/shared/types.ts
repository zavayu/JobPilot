export const APPLICATION_STATUSES = [
  "Interested",
  "Applied",
  "Online Assessment",
  "Recruiter Screen",
  "Technical Interview",
  "Final Interview",
  "Offer",
  "Rejected",
  "Ghosted",
  "Withdrawn"
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type Priority = "low" | "medium" | "high";

export type ProfileDTO = {
  id: string;
  name: string;
  email?: string | null;
  targetRoles: string[];
  preferredLocations: string[];
  remotePreference?: string | null;
  workAuthorization?: string | null;
  skills: string[];
  industries: string[];
  summary?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobPostingDTO = {
  id: string;
  company: string;
  title: string;
  location?: string | null;
  remoteType?: string | null;
  description: string;
  requirements: string[];
  preferredQualifications: string[];
  technologies: string[];
  source: string;
  sourceUrl?: string | null;
  sourceRepo?: string | null;
  sourceCommit?: string | null;
  datePosted?: string | null;
  dateFound: string;
  employmentType?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ResumeDTO = {
  id: string;
  title: string;
  targetRole?: string | null;
  tags: string[];
  filePath: string;
  originalFileName: string;
  fileType: "pdf" | "docx";
  extractedText?: string | null;
  version: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
};

export type ResumePreviewDTO = {
  resumeId: string;
  fileType: "pdf" | "docx";
  dataUrl?: string | null;
};

export type ApplicationDTO = {
  id: string;
  jobPostingId: string;
  status: ApplicationStatus | string;
  resumeId?: string | null;
  dateApplied?: string | null;
  notes?: string | null;
  matchScore?: number | null;
  priority?: Priority | string | null;
  createdAt: string;
  updatedAt: string;
  jobPosting?: JobPostingDTO;
  resume?: ResumeDTO | null;
};

export type ExperienceDTO = {
  id: string;
  title: string;
  organization?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  description?: string | null;
  technologies: string[];
  bullets: string[];
  impactMetrics: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type MatchAnalysisDTO = {
  id: string;
  jobPostingId: string;
  resumeId?: string | null;
  score: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  relevantExperienceIds: string[];
  recommendedResumeId?: string | null;
  suggestedChanges: string[];
  applicationPriority?: string | null;
  interviewPrepTopics: string[];
  createdAt: string;
};

export type ResumeSuggestion = {
  originalBullet: string;
  suggestedBullet: string;
  reason: string;
  sourceExperienceId?: string | null;
};

export type ResumeDraftDTO = {
  id: string;
  baseResumeId: string;
  jobPostingId: string;
  title: string;
  content: string;
  format: "markdown";
  filePath?: string | null;
  changeSummary: string[];
  createdAt: string;
  updatedAt: string;
  baseResume?: ResumeDTO;
  jobPosting?: JobPostingDTO;
};

export type SettingsDTO = {
  openAiApiKeySet: boolean;
  openAiApiKey?: string;
  openAiModel: string;
  theme: "light" | "dark";
  dataDirectory: string;
  jobImportUrl: string;
  jobImportSources: JobImportSourceDTO[];
  jobAutoSyncEnabled: boolean;
  jobAutoSyncIntervalHours: number;
  lastJobImportAt?: string | null;
};

export type JobImportSourceDTO = {
  id: string;
  name: string;
  provider: string;
  url: string;
  enabled: boolean;
};

export type ImportedJobStatus = "new" | "saved" | "ignored";

export type ImportedJobDTO = {
  id: string;
  sourceKey: string;
  company: string;
  companyUrl?: string | null;
  title: string;
  location?: string | null;
  salary?: string | null;
  postingUrl: string;
  age?: string | null;
  category: string;
  status: ImportedJobStatus | string;
  sourceName: string;
  sourceUrl: string;
  sourceRepo?: string | null;
  sourceCommit?: string | null;
  rawMarkdown: string;
  importedAt: string;
  lastSeenAt: string;
  savedJobId?: string | null;
};

export type ImportedJobBatchDTO = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  sourceCommit?: string | null;
  fetchedAt: string;
  totalFound: number;
  newJobs: number;
  updatedJobs: number;
  duplicateJobs: number;
  errors: string[];
};

export type JobImportSyncResult = {
  batches: ImportedJobBatchDTO[];
  recentJobs: ImportedJobDTO[];
};

export type GoogleSheetsStatusDTO = {
  clientIdSet: boolean;
  clientSecretSet: boolean;
  connected: boolean;
  spreadsheetId?: string | null;
  spreadsheetUrl?: string | null;
  lastSyncAt?: string | null;
  lastError?: string | null;
};

export type GoogleSheetsConfigInput = {
  clientId?: string;
  clientSecret?: string;
  spreadsheetId?: string;
};

export type GoogleSheetsSyncResultDTO = {
  spreadsheetId: string;
  spreadsheetUrl: string;
  jobListingsSynced: number;
  applicationsSynced: number;
  syncedAt: string;
};

export type DashboardMetrics = {
  totalJobs: number;
  totalApplications: number;
  totalResumes: number;
  totalExperiences: number;
  byStatus: Array<{ status: string; count: number }>;
  recentApplications: ApplicationDTO[];
  responseRate: number;
  interviewRate: number;
  offerRate: number;
};

export type CreateJobInput = {
  company: string;
  title: string;
  location?: string;
  remoteType?: string;
  sourceUrl?: string;
  description: string;
  employmentType?: string;
  status?: ApplicationStatus | string;
  notes?: string;
};

export type UpdateApplicationInput = {
  status?: ApplicationStatus | string;
  resumeId?: string | null;
  dateApplied?: string | null;
  notes?: string | null;
  priority?: Priority | string | null;
};

export type UpsertProfileInput = Omit<Partial<ProfileDTO>, "id" | "createdAt" | "updatedAt">;
export type UpsertExperienceInput = Omit<Partial<ExperienceDTO>, "id" | "createdAt" | "updatedAt"> & {
  title: string;
};

export type JobDetailDTO = {
  job: JobPostingDTO;
  application: ApplicationDTO | null;
  matches: MatchAnalysisDTO[];
  drafts: ResumeDraftDTO[];
};

export type JobPilotApi = {
  profile: {
    get: () => Promise<ProfileDTO>;
    update: (input: UpsertProfileInput) => Promise<ProfileDTO>;
  };
  jobs: {
    list: () => Promise<ApplicationDTO[]>;
    create: (input: CreateJobInput) => Promise<ApplicationDTO>;
    getDetail: (jobPostingId: string) => Promise<JobDetailDTO>;
    delete: (jobPostingId: string) => Promise<void>;
  };
  applications: {
    update: (applicationId: string, input: UpdateApplicationInput) => Promise<ApplicationDTO>;
  };
  resumes: {
    importResume: () => Promise<ResumeDTO | null>;
    list: () => Promise<ResumeDTO[]>;
    preview: (resumeId: string) => Promise<ResumePreviewDTO>;
    update: (resumeId: string, input: Partial<Pick<ResumeDTO, "title" | "targetRole" | "tags" | "notes">>) => Promise<ResumeDTO>;
    delete: (resumeId: string) => Promise<void>;
  };
  experiences: {
    list: () => Promise<ExperienceDTO[]>;
    create: (input: UpsertExperienceInput) => Promise<ExperienceDTO>;
    update: (experienceId: string, input: UpsertExperienceInput) => Promise<ExperienceDTO>;
    delete: (experienceId: string) => Promise<void>;
  };
  ai: {
    parseJob: (jobPostingId: string) => Promise<JobPostingDTO>;
    matchJob: (jobPostingId: string, resumeId?: string | null) => Promise<MatchAnalysisDTO>;
    generateResumeDraft: (jobPostingId: string, resumeId: string) => Promise<ResumeDraftDTO>;
  };
  drafts: {
    list: () => Promise<ResumeDraftDTO[]>;
    exportMarkdown: (draftId: string) => Promise<string>;
  };
  imports: {
    sync: (sourceId?: string | null) => Promise<JobImportSyncResult>;
    list: (status?: ImportedJobStatus | "all", sourceId?: string | "all") => Promise<ImportedJobDTO[]>;
    save: (importedJobId: string) => Promise<ApplicationDTO>;
    ignore: (importedJobId: string) => Promise<ImportedJobDTO>;
  };
  settings: {
    get: () => Promise<SettingsDTO>;
    update: (
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
    ) => Promise<SettingsDTO>;
  };
  analytics: {
    get: () => Promise<DashboardMetrics>;
  };
  googleSheets: {
    getStatus: () => Promise<GoogleSheetsStatusDTO>;
    saveConfig: (input: GoogleSheetsConfigInput) => Promise<GoogleSheetsStatusDTO>;
    connect: () => Promise<GoogleSheetsStatusDTO>;
    disconnect: () => Promise<void>;
    createSpreadsheet: () => Promise<GoogleSheetsStatusDTO>;
    sync: () => Promise<GoogleSheetsSyncResultDTO>;
  };
};
