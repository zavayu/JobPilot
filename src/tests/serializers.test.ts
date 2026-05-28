import { describe, expect, it } from "vitest";
import { parseJsonArray, stringifyArray, toApplicationDTO, toJobDTO } from "../main/serializers";

describe("serialization helpers", () => {
  it("parses JSON arrays and comma-separated fallback values", () => {
    expect(parseJsonArray('["React","TypeScript"]')).toEqual(["React", "TypeScript"]);
    expect(parseJsonArray("React, TypeScript, SQLite")).toEqual(["React", "TypeScript", "SQLite"]);
    expect(parseJsonArray(null)).toEqual([]);
  });

  it("stringifies list inputs for SQLite storage", () => {
    expect(stringifyArray(["React", "SQLite"])).toBe('["React","SQLite"]');
    expect(stringifyArray("React, SQLite")).toBe('["React","SQLite"]');
    expect(stringifyArray(undefined)).toBe("[]");
  });

  it("normalizes job and application records for the renderer", () => {
    const now = new Date("2026-05-27T12:00:00.000Z");
    const job = toJobDTO({
      id: "job-1",
      company: "Acme",
      title: "Software Engineer",
      location: "Remote",
      remoteType: "remote",
      description: "Build systems",
      requirements: '["TypeScript"]',
      preferredQualifications: "Cloud, Docker",
      technologies: '["React"]',
      source: "manual",
      dateFound: now,
      createdAt: now,
      updatedAt: now
    });

    expect(job.requirements).toEqual(["TypeScript"]);
    expect(job.preferredQualifications).toEqual(["Cloud", "Docker"]);

    const application = toApplicationDTO({
      id: "app-1",
      jobPostingId: "job-1",
      status: "Interested",
      createdAt: now,
      updatedAt: now,
      jobPosting: {
        ...job,
        requirements: '["TypeScript"]',
        preferredQualifications: "Cloud",
        technologies: "React"
      }
    });

    expect(application.jobPosting?.company).toBe("Acme");
    expect(application.createdAt).toBe(now.toISOString());
  });
});
