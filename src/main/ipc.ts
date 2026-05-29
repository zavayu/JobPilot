import { ipcMain } from "electron";
import { generateResumeDraft, matchJob, parseJob } from "./ai";
import {
  connectGoogleSheets,
  createGoogleSpreadsheet,
  disconnectGoogleSheets,
  getGoogleSheetsStatus,
  saveGoogleSheetsConfig,
  syncGoogleSheets
} from "./googleSheets";
import { ignoreImportedJob, listImportedJobs, saveImportedJob, syncImportedJobs } from "./jobImport";
import {
  createExperience,
  createJob,
  deleteExperience,
  deleteJob,
  deleteResume,
  exportMarkdownDraft,
  getAnalytics,
  getJobDetail,
  getProfile,
  getSettings,
  importResume,
  listApplications,
  listDrafts,
  listExperiences,
  listResumes,
  previewResume,
  updateApplication,
  updateExperience,
  updateProfile,
  updateResume,
  updateSettings
} from "./services";

function handle(channel: string, listener: (...args: any[]) => Promise<any> | any): void {
  ipcMain.handle(channel, async (_event, ...args) => listener(...args));
}

export function registerIpcHandlers(): void {
  handle("profile:get", getProfile);
  handle("profile:update", updateProfile);

  handle("jobs:list", listApplications);
  handle("jobs:create", createJob);
  handle("jobs:getDetail", getJobDetail);
  handle("jobs:delete", deleteJob);

  handle("applications:update", updateApplication);

  handle("resumes:import", importResume);
  handle("resumes:list", listResumes);
  handle("resumes:preview", previewResume);
  handle("resumes:update", updateResume);
  handle("resumes:delete", deleteResume);

  handle("experiences:list", listExperiences);
  handle("experiences:create", createExperience);
  handle("experiences:update", updateExperience);
  handle("experiences:delete", deleteExperience);

  handle("ai:parseJob", parseJob);
  handle("ai:matchJob", matchJob);
  handle("ai:generateResumeDraft", generateResumeDraft);

  handle("drafts:list", listDrafts);
  handle("drafts:exportMarkdown", exportMarkdownDraft);

  handle("imports:sync", syncImportedJobs);
  handle("imports:list", listImportedJobs);
  handle("imports:save", saveImportedJob);
  handle("imports:ignore", ignoreImportedJob);

  handle("settings:get", getSettings);
  handle("settings:update", updateSettings);

  handle("analytics:get", getAnalytics);

  handle("googleSheets:getStatus", getGoogleSheetsStatus);
  handle("googleSheets:saveConfig", saveGoogleSheetsConfig);
  handle("googleSheets:connect", connectGoogleSheets);
  handle("googleSheets:disconnect", disconnectGoogleSheets);
  handle("googleSheets:createSpreadsheet", createGoogleSpreadsheet);
  handle("googleSheets:sync", syncGoogleSheets);
}
