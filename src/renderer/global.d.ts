import type { JobPilotApi } from "../shared/types";

declare global {
  interface Window {
    jobPilot: JobPilotApi;
  }
}

export {};
