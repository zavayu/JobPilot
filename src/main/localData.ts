import { app } from "electron";
import fs from "node:fs/promises";
import path from "node:path";

export type LocalDataPaths = {
  dataDir: string;
  dbPath: string;
  resumesOriginalDir: string;
  resumesExtractedDir: string;
  draftsDir: string;
  exportsDir: string;
  importsDir: string;
  logsDir: string;
};

let cachedPaths: LocalDataPaths | null = null;

export function getLocalDataPaths(): LocalDataPaths {
  if (cachedPaths) {
    return cachedPaths;
  }

  const dataDir = path.join(app.getPath("userData"), "JobPilotData");
  cachedPaths = {
    dataDir,
    dbPath: path.join(dataDir, "jobpilot.db"),
    resumesOriginalDir: path.join(dataDir, "resumes", "original"),
    resumesExtractedDir: path.join(dataDir, "resumes", "extracted"),
    draftsDir: path.join(dataDir, "drafts"),
    exportsDir: path.join(dataDir, "exports"),
    importsDir: path.join(dataDir, "imports"),
    logsDir: path.join(dataDir, "logs")
  };

  return cachedPaths;
}

export async function ensureLocalDataDirs(): Promise<LocalDataPaths> {
  const paths = getLocalDataPaths();
  await Promise.all([
    fs.mkdir(paths.dataDir, { recursive: true }),
    fs.mkdir(paths.resumesOriginalDir, { recursive: true }),
    fs.mkdir(paths.resumesExtractedDir, { recursive: true }),
    fs.mkdir(paths.draftsDir, { recursive: true }),
    fs.mkdir(paths.exportsDir, { recursive: true }),
    fs.mkdir(paths.importsDir, { recursive: true }),
    fs.mkdir(paths.logsDir, { recursive: true })
  ]);
  return paths;
}

export function toPrismaSqliteUrl(filePath: string): string {
  return `file:${filePath.replace(/\\/g, "/")}`;
}
