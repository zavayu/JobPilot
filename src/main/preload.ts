import { contextBridge, ipcRenderer } from "electron";
import type { JobPilotApi } from "../shared/types";

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> => ipcRenderer.invoke(channel, ...args);

const api: JobPilotApi = {
  profile: {
    get: () => invoke("profile:get"),
    update: (input) => invoke("profile:update", input)
  },
  jobs: {
    list: () => invoke("jobs:list"),
    create: (input) => invoke("jobs:create", input),
    getDetail: (jobPostingId) => invoke("jobs:getDetail", jobPostingId),
    delete: (jobPostingId) => invoke("jobs:delete", jobPostingId)
  },
  applications: {
    update: (applicationId, input) => invoke("applications:update", applicationId, input)
  },
  resumes: {
    importResume: () => invoke("resumes:import"),
    list: () => invoke("resumes:list"),
    update: (resumeId, input) => invoke("resumes:update", resumeId, input),
    delete: (resumeId) => invoke("resumes:delete", resumeId)
  },
  experiences: {
    list: () => invoke("experiences:list"),
    create: (input) => invoke("experiences:create", input),
    update: (experienceId, input) => invoke("experiences:update", experienceId, input),
    delete: (experienceId) => invoke("experiences:delete", experienceId)
  },
  ai: {
    parseJob: (jobPostingId) => invoke("ai:parseJob", jobPostingId),
    matchJob: (jobPostingId, resumeId) => invoke("ai:matchJob", jobPostingId, resumeId),
    generateResumeDraft: (jobPostingId, resumeId) => invoke("ai:generateResumeDraft", jobPostingId, resumeId)
  },
  drafts: {
    list: () => invoke("drafts:list"),
    exportMarkdown: (draftId) => invoke("drafts:exportMarkdown", draftId)
  },
  imports: {
    sync: () => invoke("imports:sync"),
    list: (status) => invoke("imports:list", status),
    save: (importedJobId) => invoke("imports:save", importedJobId),
    ignore: (importedJobId) => invoke("imports:ignore", importedJobId)
  },
  settings: {
    get: () => invoke("settings:get"),
    update: (input) => invoke("settings:update", input)
  },
  analytics: {
    get: () => invoke("analytics:get")
  }
};

contextBridge.exposeInMainWorld("jobPilot", api);
