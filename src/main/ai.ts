import OpenAI from "openai";
import { z } from "zod";
import { getPrisma } from "./database";
import { getLocalDataPaths } from "./localData";
import { getProfile, getSettings, listExperiences, listResumes } from "./services";
import { stringifyArray, toDraftDTO, toJobDTO, toMatchDTO } from "./serializers";
import fs from "node:fs/promises";
import path from "node:path";

const parsedJobSchema = z.object({
  requirements: z.array(z.string()),
  preferredQualifications: z.array(z.string()),
  technologies: z.array(z.string()),
  employmentType: z.string().nullable(),
  remoteType: z.string().nullable()
});

const matchSchema = z.object({
  score: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missingSkills: z.array(z.string()),
  relevantExperienceIds: z.array(z.string()),
  recommendedResumeId: z.string().nullable(),
  suggestedChanges: z.array(z.string()),
  applicationPriority: z.enum(["low", "medium", "high"]).nullable(),
  interviewPrepTopics: z.array(z.string())
});

const resumeDraftSchema = z.object({
  title: z.string(),
  markdown: z.string(),
  changeSummary: z.array(z.string()),
  suggestions: z.array(
    z.object({
      originalBullet: z.string(),
      suggestedBullet: z.string(),
      reason: z.string(),
      sourceExperienceId: z.string().nullable()
    })
  )
});

function jsonSchema(name: string, schema: Record<string, unknown>) {
  return {
    type: "json_schema",
    name,
    strict: true,
    schema
  };
}

const parsedJobJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["requirements", "preferredQualifications", "technologies", "employmentType", "remoteType"],
  properties: {
    requirements: { type: "array", items: { type: "string" } },
    preferredQualifications: { type: "array", items: { type: "string" } },
    technologies: { type: "array", items: { type: "string" } },
    employmentType: { anyOf: [{ type: "string" }, { type: "null" }] },
    remoteType: { anyOf: [{ type: "string" }, { type: "null" }] }
  }
};

const matchJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "score",
    "strengths",
    "weaknesses",
    "missingSkills",
    "relevantExperienceIds",
    "recommendedResumeId",
    "suggestedChanges",
    "applicationPriority",
    "interviewPrepTopics"
  ],
  properties: {
    score: { type: "integer" },
    strengths: { type: "array", items: { type: "string" } },
    weaknesses: { type: "array", items: { type: "string" } },
    missingSkills: { type: "array", items: { type: "string" } },
    relevantExperienceIds: { type: "array", items: { type: "string" } },
    recommendedResumeId: { anyOf: [{ type: "string" }, { type: "null" }] },
    suggestedChanges: { type: "array", items: { type: "string" } },
    applicationPriority: { anyOf: [{ type: "string", enum: ["low", "medium", "high"] }, { type: "null" }] },
    interviewPrepTopics: { type: "array", items: { type: "string" } }
  }
};

const resumeDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "markdown", "changeSummary", "suggestions"],
  properties: {
    title: { type: "string" },
    markdown: { type: "string" },
    changeSummary: { type: "array", items: { type: "string" } },
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["originalBullet", "suggestedBullet", "reason", "sourceExperienceId"],
        properties: {
          originalBullet: { type: "string" },
          suggestedBullet: { type: "string" },
          reason: { type: "string" },
          sourceExperienceId: { anyOf: [{ type: "string" }, { type: "null" }] }
        }
      }
    }
  }
};

async function openaiJson<T>(schemaName: string, schema: Record<string, unknown>, instructions: string, input: string, parser: z.ZodType<T>): Promise<T> {
  const settings = await getSettings();
  if (!settings.openAiApiKey) {
    throw new Error("OpenAI API key is missing. Add it in Settings before running AI actions.");
  }

  const client = new OpenAI({ apiKey: settings.openAiApiKey });
  const response = await client.responses.create({
    model: settings.openAiModel || "gpt-4.1-mini",
    instructions,
    input,
    text: {
      format: jsonSchema(schemaName, schema)
    }
  } as any);

  const raw = (response as any).output_text;
  if (!raw) {
    throw new Error("OpenAI returned an empty response.");
  }
  return parser.parse(JSON.parse(raw));
}

export async function parseJob(jobPostingId: string) {
  const prisma = await getPrisma();
  const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } });
  const parsed = await openaiJson(
    "job_posting_parse",
    parsedJobJsonSchema,
    "Extract structured job posting fields. Return concise lists and do not infer unsupported details.",
    `Company: ${job.company}\nTitle: ${job.title}\nLocation: ${job.location ?? ""}\nDescription:\n${job.description}`,
    parsedJobSchema
  );

  const updated = await prisma.jobPosting.update({
    where: { id: jobPostingId },
    data: {
      requirements: stringifyArray(parsed.requirements),
      preferredQualifications: stringifyArray(parsed.preferredQualifications),
      technologies: stringifyArray(parsed.technologies),
      employmentType: parsed.employmentType,
      remoteType: parsed.remoteType,
      updatedAt: new Date()
    }
  });
  return toJobDTO(updated);
}

export async function matchJob(jobPostingId: string, resumeId?: string | null) {
  const prisma = await getPrisma();
  const [job, profile, resumes, experiences] = await Promise.all([
    prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } }),
    getProfile(),
    listResumes(),
    listExperiences()
  ]);
  const selectedResume = resumeId ? resumes.find((resume) => resume.id === resumeId) : resumes[0];

  const parsed = await openaiJson(
    "job_match_analysis",
    matchJsonSchema,
    [
      "Score a job fit using only the user's profile, resumes, and verified experience.",
      "Do not invent skills, metrics, employers, dates, ownership, or qualifications.",
      "If evidence is missing, list it as a weakness or missing skill."
    ].join(" "),
    JSON.stringify(
      {
        job,
        profile,
        selectedResume,
        resumes: resumes.map((resume) => ({
          id: resume.id,
          title: resume.title,
          targetRole: resume.targetRole,
          tags: resume.tags,
          extractedText: resume.extractedText
        })),
        experiences
      },
      null,
      2
    ),
    matchSchema
  );

  const created = await prisma.$transaction(async (tx) => {
    const match = await tx.matchAnalysis.create({
      data: {
        id: crypto.randomUUID(),
        jobPostingId,
        resumeId: selectedResume?.id ?? null,
        score: parsed.score,
        strengths: stringifyArray(parsed.strengths),
        weaknesses: stringifyArray(parsed.weaknesses),
        missingSkills: stringifyArray(parsed.missingSkills),
        relevantExperienceIds: stringifyArray(parsed.relevantExperienceIds),
        recommendedResumeId: parsed.recommendedResumeId,
        suggestedChanges: stringifyArray(parsed.suggestedChanges),
        applicationPriority: parsed.applicationPriority,
        interviewPrepTopics: stringifyArray(parsed.interviewPrepTopics)
      }
    });
    await tx.application.updateMany({
      where: { jobPostingId },
      data: {
        matchScore: parsed.score,
        priority: parsed.applicationPriority ?? undefined,
        updatedAt: new Date()
      }
    });
    return match;
  });

  return toMatchDTO(created);
}

export async function generateResumeDraft(jobPostingId: string, resumeId: string) {
  const prisma = await getPrisma();
  const [job, resume, profile, experiences] = await Promise.all([
    prisma.jobPosting.findUniqueOrThrow({ where: { id: jobPostingId } }),
    prisma.resume.findUniqueOrThrow({ where: { id: resumeId } }),
    getProfile(),
    listExperiences()
  ]);

  const parsed = await openaiJson(
    "resume_draft",
    resumeDraftJsonSchema,
    [
      "Create a tailored resume draft in Markdown using only verified resume text and verified experiences.",
      "Do not add fabricated technologies, metrics, employers, dates, or achievements.",
      "For each suggestion, include the source experience ID when one supports the change.",
      "Keep the draft concise and practical for a software engineering application."
    ].join(" "),
    JSON.stringify(
      {
        job,
        profile,
        baseResume: {
          id: resume.id,
          title: resume.title,
          extractedText: resume.extractedText
        },
        verifiedExperiences: experiences
      },
      null,
      2
    ),
    resumeDraftSchema
  );

  const paths = getLocalDataPaths();
  const title = parsed.title || `${resume.title} - ${job.company}`;
  const filePath = path.join(paths.draftsDir, `${Date.now()}-${title.replace(/[^\w.-]/g, "_")}.md`);
  await fs.writeFile(filePath, parsed.markdown, "utf8");

  const created = await prisma.resumeDraft.create({
    data: {
      id: crypto.randomUUID(),
      baseResumeId: resumeId,
      jobPostingId,
      title,
      content: parsed.markdown,
      format: "markdown",
      filePath,
      changeSummary: stringifyArray(parsed.changeSummary)
    },
    include: { baseResume: true, jobPosting: true }
  });

  return toDraftDTO(created);
}
