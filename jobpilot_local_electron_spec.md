# JobPilot Local Electron Project Specification

## 1. Project Overview

**JobPilot** is a local-first, AI-assisted job search CRM for software engineers. It helps users organize job postings, track applications, manage resume versions, compare jobs against their experience, and generate tailored application materials.

This version of JobPilot is designed as a **personal desktop application** rather than a hosted SaaS product. It runs locally with Electron, stores data on the user's machine, and avoids deployment, hosting, multi-user authentication, and cloud file storage concerns.

The product should not fully automate job applications. The user remains in control of reviewing jobs, approving resume changes, and submitting applications manually.

---

## 2. Product Vision

JobPilot should act as a personal job search command center.

A user should be able to:

1. Store their profile, skills, experience, projects, and resume versions locally.
2. Add jobs manually by entering or pasting job posting details.
3. Track every application in a structured dashboard.
4. Compare job postings against their verified background.
5. Generate AI-assisted resume suggestions and application materials.
6. Understand which roles, resumes, and application patterns are performing best.
7. Eventually import job postings from a maintained GitHub repository of job listings.

The long-term goal is to make job searching more organized, personalized, and efficient without sacrificing accuracy, privacy, or user control.

---

## 3. Local-First Scope

This project is intended to run locally on a personal machine.

### Removed From Scope

The local Electron version does not need:

- Hosted authentication
- Multi-user account management
- S3, Supabase Storage, UploadThing, or other cloud file storage
- Hosted PostgreSQL
- Production deployment
- Public file URLs
- Server-side multi-tenant authorization
- External job board account storage
- Automated job submissions

### Still In Scope

The app should still include:

- Local application tracking
- Local resume file management
- Local database storage
- Resume text extraction
- Job description parsing
- AI-assisted matching and resume tailoring
- Local analytics
- Optional AI provider configuration
- Future background job importing from a GitHub job postings repository

---

## 4. Target User

The primary user is the developer building the project, with the product designed around software engineering students, new graduates, and early-career developers.

These users often:

- Apply to many roles.
- Track applications in spreadsheets.
- Maintain several resume versions.
- Need to tailor resumes for different roles.
- Want help deciding which jobs are worth applying to.
- Want job search organization without giving a third-party service all their files.

---

## 5. Core Value Proposition

JobPilot helps answer four questions:

1. **What jobs am I interested in?**
2. **What is the status of every application?**
3. **How well do I match a job?**
4. **Which resume or resume changes should I use?**

The app combines a local CRM, resume manager, experience database, and AI assistant into a single desktop workflow.

---

## 6. Recommended Local Tech Stack

## 6.1 Desktop App

Recommended:

- Electron
- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui

Why:

- Electron provides a desktop shell with filesystem access.
- React and TypeScript support a polished dashboard UI.
- Vite keeps the local development loop fast.
- Tailwind and shadcn/ui are effective for building forms, tables, dialogs, and dashboards.

## 6.2 Local Database

Recommended:

- SQLite
- Prisma ORM or Drizzle ORM

Preferred default:

- SQLite with Prisma

Why:

- SQLite is simple, local, portable, and reliable for a personal app.
- It avoids local PostgreSQL setup.
- The database can live inside the app data directory.
- Prisma keeps schema modeling approachable and portfolio-friendly.

## 6.3 Local File Storage

Resume files and generated outputs should be stored on the local filesystem.

Example storage structure:

```text
JobPilotData/
  jobpilot.db
  resumes/
    original/
    extracted/
  drafts/
  exports/
  imports/
  logs/
```

Stored files may include:

- Uploaded PDF resumes
- Uploaded DOCX resumes
- Extracted resume text
- Generated Markdown drafts
- Generated DOCX exports
- Imported job posting snapshots

## 6.4 AI Layer

The app can support one or more AI providers.

Recommended MVP approach:

- Use a configurable hosted LLM API key stored locally.
- Keep prompts and outputs structured.
- Store AI results in the local SQLite database.

Possible future local-only option:

- Ollama or another local model runtime.

Tradeoff:

- Hosted models usually produce better resume analysis and rewriting.
- Local models improve privacy but may be less reliable for nuanced career writing.

## 6.5 Background Jobs

For the MVP, background jobs are not required.

Future background jobs can be used for:

- Pulling job postings from a GitHub repository.
- Deduplicating imported postings.
- Parsing job descriptions.
- Running match analysis on newly imported jobs.
- Refreshing analytics.

Possible tools:

- Electron main process scheduled task
- Node cron-style scheduler
- Manual "Sync Jobs" button first, scheduled sync later

---

## 7. High-Level Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                    Electron Desktop App                  │
├──────────────────────────────────────────────────────────┤
│  Renderer Process                                        │
│  React + TypeScript + Tailwind + shadcn/ui               │
├──────────────────────────────────────────────────────────┤
│  Main Process / Local Service Layer                      │
│  File access | SQLite access | AI calls | Import jobs    │
├──────────────────────────────────────────────────────────┤
│  Local Storage                                           │
│  SQLite DB | Resume files | Drafts | Exports | Imports   │
└──────────────────────────────────────────────────────────┘
                  │
                  ▼
        Optional Hosted AI Provider

Future:

GitHub Job Postings Repo -> Local Import Job -> SQLite
```

---

## 8. Core Features

## 8.1 Application Tracking Dashboard

### Description

The dashboard is the central workspace for managing job opportunities and applications.

It should replace a spreadsheet with a cleaner local desktop interface.

### Key Capabilities

Users can:

- Add a job manually.
- Paste a job description.
- Track application status.
- Attach a local resume version to an application.
- Add notes, deadlines, interview dates, and follow-up reminders.
- Search, sort, and filter applications.
- View application details.
- See AI match scores and explanations.

### Default Application Statuses

- Interested
- Applied
- Online Assessment
- Recruiter Screen
- Technical Interview
- Final Interview
- Offer
- Rejected
- Ghosted
- Withdrawn

Status customization can be added later.

### MVP View

The MVP should start with a table view.

Suggested columns:

| Field | Description |
|---|---|
| Company | Company name |
| Role | Job title |
| Status | Current application stage |
| Location | Job location or remote status |
| Date Found | When the job was added |
| Date Applied | When the user applied |
| Resume Used | Resume version submitted |
| Match Score | AI-generated fit score |
| Source | Manual, imported, GitHub repo, etc. |
| Notes | User notes |

### Later View

Add Kanban view after the table workflow is stable.

Example columns:

```text
Interested -> Applied -> Interviewing -> Offer -> Rejected
```

---

## 8.2 Job Detail View

Each job should have a detail page or panel.

Includes:

- Company
- Role title
- Location
- Remote type
- Employment type
- Seniority
- Source
- Source URL
- Full job description
- Parsed requirements
- Parsed technologies
- Application status
- Resume used
- Match analysis
- AI notes
- User notes
- Timeline of status changes
- Follow-up date or reminder, if applicable

---

## 8.3 Resume Bank

### Description

The resume bank stores and organizes local resume files and their extracted text.

### Key Capabilities

Users can:

- Add PDF or DOCX resumes from the local filesystem.
- Copy resumes into the app's local data folder.
- Store multiple resume versions.
- Tag resumes by role type.
- Preview resume metadata.
- Extract text from resumes for AI analysis.
- Track which resume was used for which application.
- Create AI-assisted resume drafts.
- Export generated drafts.

### Resume Metadata

| Field | Description |
|---|---|
| Title | User-friendly resume name |
| File Path | Local stored file path |
| Extracted Text | Parsed resume content |
| Target Role | Intended role type |
| Tags | Backend, cloud, AI, full-stack, etc. |
| Created Date | When the resume was added |
| Last Used | Most recent application using the resume |
| Version | Resume version number |

---

## 8.4 Experience and Project Bank

### Description

The experience and project bank stores verified facts about the user's background. It is the source of truth for AI-generated resume suggestions.

### Key Capabilities

Users can add structured entries for:

- Work experience
- Internships
- Projects
- Research
- Leadership experience
- Technical skills
- Certifications
- Coursework
- Awards

### Experience Entry Fields

| Field | Description |
|---|---|
| Title | Role or project name |
| Organization | Company, school, club, or personal project |
| Start Date | Start date |
| End Date | End date or present |
| Description | Short overview |
| Technologies | Languages, frameworks, tools, platforms |
| Verified Bullets | Resume-safe bullet facts |
| Impact Metrics | Performance, scale, users, time saved, etc. |
| Tags | Backend, cloud, AI, systems, leadership, etc. |

### Purpose

This enables truth-constrained generation.

The AI can:

- Rewrite bullets.
- Reorder bullets.
- Emphasize relevant skills.
- Suggest stronger wording.
- Match experiences to job requirements.

The AI should not:

- Invent jobs.
- Invent technologies.
- Invent metrics.
- Claim leadership or ownership the user did not provide.
- Add false qualifications.

---

## 8.5 Manual Job Entry

### MVP Priority

Manual job entry should be the first job intake workflow.

Users should be able to:

- Add company name.
- Add role title.
- Add location.
- Add source URL.
- Paste the full job description.
- Select employment type.
- Select seniority.
- Save the job as Interested or Applied.
- Trigger AI parsing and matching manually.

This avoids fragile scraping and lets the MVP focus on the core tracking and resume workflows.

---

## 8.6 AI Job Matching

### Description

The AI job matching system compares a job posting against the user's profile, resumes, and verified experience bank.

The output should be understandable, explainable, and actionable.

### Key Capabilities

For each job, the AI can generate:

- Match score
- Strengths
- Weaknesses
- Missing skills
- Relevant experiences
- Recommended resume
- Suggested resume changes
- Application priority
- Interview preparation topics

### Suggested Match Score Criteria

| Category | Weight |
|---|---:|
| Skills Match | 30% |
| Experience Relevance | 25% |
| Role Alignment | 20% |
| Location and Logistics Fit | 15% |
| Seniority Fit | 10% |

The score should be explainable. The user should understand why a job is ranked highly or poorly.

---

## 8.7 AI Resume Tailoring

### Description

The AI resume tailoring feature helps users create a resume draft customized for a specific job posting.

Generated drafts must be based only on verified information from the resume bank and experience bank.

### Key Capabilities

Users can:

- Select a job posting.
- Select a base resume.
- Generate suggested resume changes.
- Review original and suggested bullets side by side.
- Accept, reject, or edit suggestions.
- Save a tailored draft locally.
- Export the final draft as Markdown or DOCX.

### Tailoring Actions

The AI can:

- Reorder existing bullets.
- Rewrite bullets for clarity and relevance.
- Emphasize technologies found in the job description.
- Suggest which projects to include or remove.
- Suggest stronger action verbs.
- Identify missing keywords.
- Generate a summary of changes.

The AI should not:

- Add fabricated metrics.
- Add technologies the user has not used.
- Add false work experience.
- Claim direct experience with tools only mentioned in coursework unless labeled correctly.

---

## 8.8 Analytics and Insights

### Description

The analytics page helps the user understand their job search progress.

### Key Capabilities

Show metrics such as:

- Total jobs saved
- Total applications submitted
- Applications per week
- Response rate
- Interview rate
- Offer rate
- Rejection rate
- Average time between stages
- Best-performing resume version
- Best-performing role type
- Applications with no update in 21 or more days

Analytics can be simple in the MVP and expanded later.

---

## 9. Future Job Fetching From GitHub

## 9.1 Goal

JobPilot should eventually import job postings from a GitHub repository that already maintains job postings.

This approach avoids scraping job boards directly and keeps the import pipeline simpler and more reliable.

## 9.2 Initial Future Workflow

1. User configures a GitHub repository URL or selects a supported default repo.
2. User clicks **Sync Jobs**.
3. JobPilot pulls or downloads the latest postings.
4. JobPilot parses the repo's job data format.
5. JobPilot normalizes postings into the local SQLite schema.
6. JobPilot deduplicates postings by company, title, location, and source URL.
7. User reviews imported jobs.
8. User saves interesting jobs to the application tracker or ignores them.

## 9.3 Later Scheduled Workflow

After manual sync works reliably:

1. JobPilot runs a local scheduled import occasionally.
2. The app checks the configured GitHub repository for updates.
3. New postings are imported into a review queue.
4. Optional AI matching runs on newly imported jobs.
5. The user sees newly imported jobs the next time the app opens.

## 9.4 GitHub Import Design Notes

The import system should:

- Prefer structured files such as JSON, YAML, CSV, or Markdown tables.
- Track the source repository and commit hash if available.
- Store the original source URL for each posting.
- Avoid creating duplicate jobs.
- Keep imported jobs separate from saved applications until the user chooses to save them.
- Support a review queue with Save, Ignore, and Archive actions.

## 9.5 Not In Initial MVP

The first MVP should not include GitHub job fetching.

Manual job entry is enough to validate:

- The tracker
- Resume management
- AI matching
- Resume tailoring
- Local persistence

---

## 10. MVP Scope

The MVP should focus on building a useful local desktop application before adding automated imports.

## 10.1 Must Have

- Electron desktop shell
- React and TypeScript UI
- Local SQLite database
- Local file storage for resumes and drafts
- No authentication
- Single local user profile
- Application tracking dashboard
- Manual job entry
- Job status tracking
- Job detail view
- Resume upload and storage
- Resume metadata and tagging
- Resume text extraction
- Experience and project bank
- Basic AI job matching
- Basic AI resume suggestions

## 10.2 Should Have

- Table view with search, sorting, and filters
- Resume-to-application attachment
- Match score explanation
- Job description parsing
- Export tailored resume draft as Markdown
- Basic analytics
- Local settings screen for AI provider configuration

## 10.3 Could Have

- DOCX export
- Kanban view
- Follow-up reminders
- Recruiter message generation
- Resume version history
- Local app lock or passcode
- Ollama/local model support

## 10.4 Not In MVP

- GitHub job fetching
- Scheduled job imports
- LinkedIn scraping
- Indeed scraping
- Workday automation
- Browser automation
- Fully automated job applications
- Hosted authentication
- Cloud file storage
- External job board password storage
- Production deployment

---

## 11. User Workflows

## 11.1 Add and Track a Job Manually

1. User clicks **Add Job**.
2. User enters company, role, location, job link, and job description.
3. User saves the job as Interested or Applied.
4. JobPilot parses the job description.
5. User optionally runs AI matching.
6. Job appears in the dashboard.

## 11.2 Add a Resume

1. User opens the Resume Bank.
2. User selects a PDF or DOCX resume from their computer.
3. JobPilot copies the file into local app storage.
4. JobPilot extracts text from the resume.
5. User adds title, target role, tags, and notes.
6. Resume becomes available for applications and AI matching.

## 11.3 Tailor Resume for a Job

1. User opens a job detail page.
2. User clicks **Tailor Resume**.
3. User selects a base resume.
4. JobPilot compares the resume and verified experience to the job description.
5. AI suggests changes.
6. User reviews each suggestion.
7. User accepts, rejects, or edits suggestions.
8. User saves or exports the tailored draft locally.

## 11.4 Track Application Progress

1. User marks a job as Applied.
2. User attaches the submitted resume version.
3. User records the application date.
4. User updates status when events happen.
5. JobPilot maintains a local timeline of changes.
6. Analytics update automatically.

## 11.5 Future GitHub Job Sync

1. User opens the import screen.
2. User clicks **Sync Jobs**.
3. JobPilot fetches the latest postings from a configured GitHub repo.
4. JobPilot normalizes and deduplicates jobs.
5. New jobs appear in an import review queue.
6. User saves relevant jobs or ignores irrelevant jobs.

---

## 12. Data Model Draft

## 12.1 Profile

```ts
Profile {
  id: string;
  name: string;
  email?: string;
  targetRoles: string[];
  preferredLocations: string[];
  remotePreference?: string;
  workAuthorization?: string;
  skills: string[];
  industries: string[];
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 12.2 Resume

```ts
Resume {
  id: string;
  title: string;
  targetRole?: string;
  tags: string[];
  filePath: string;
  originalFileName: string;
  fileType: "pdf" | "docx";
  extractedText?: string;
  version: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
}
```

## 12.3 Experience

```ts
Experience {
  id: string;
  title: string;
  organization?: string;
  startDate?: Date;
  endDate?: Date;
  description?: string;
  technologies: string[];
  bullets: string[];
  impactMetrics: string[];
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

## 12.4 JobPosting

```ts
JobPosting {
  id: string;
  company: string;
  title: string;
  location?: string;
  remoteType?: string;
  description: string;
  requirements: string[];
  preferredQualifications: string[];
  technologies: string[];
  source: "manual" | "github_import" | "other";
  sourceUrl?: string;
  sourceRepo?: string;
  sourceCommit?: string;
  datePosted?: Date;
  dateFound: Date;
  employmentType?: string;
  seniority?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## 12.5 Application

```ts
Application {
  id: string;
  jobPostingId: string;
  status: string;
  resumeId?: string;
  dateApplied?: Date;
  notes?: string;
  matchScore?: number;
  priority?: "low" | "medium" | "high";
  createdAt: Date;
  updatedAt: Date;
}
```

## 12.6 StatusHistory

```ts
StatusHistory {
  id: string;
  applicationId: string;
  fromStatus?: string;
  toStatus: string;
  note?: string;
  changedAt: Date;
}
```

## 12.7 MatchAnalysis

```ts
MatchAnalysis {
  id: string;
  jobPostingId: string;
  resumeId?: string;
  score: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  relevantExperienceIds: string[];
  recommendedResumeId?: string;
  suggestedChanges: string[];
  applicationPriority?: string;
  interviewPrepTopics: string[];
  createdAt: Date;
}
```

## 12.8 ResumeDraft

```ts
ResumeDraft {
  id: string;
  baseResumeId: string;
  jobPostingId: string;
  title: string;
  content: string;
  format: "markdown" | "docx";
  filePath?: string;
  changeSummary: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

## 12.9 ImportedJobBatch

Future feature for GitHub imports.

```ts
ImportedJobBatch {
  id: string;
  sourceRepo: string;
  sourceCommit?: string;
  importedAt: Date;
  totalFound: number;
  newJobs: number;
  duplicateJobs: number;
  errors: string[];
}
```

---

## 13. AI Guardrails

JobPilot should prioritize accuracy and trust.

### Required Guardrails

- AI-generated resumes must be based on verified user information.
- AI should clearly separate facts from suggestions.
- AI should not invent metrics, tools, employers, dates, or achievements.
- Users must approve all generated resume changes.
- Generated content should be editable before export.
- The app should keep the original resume unchanged unless the user saves a new version.
- AI output should include the source experience or resume section used for each suggested bullet.

### Recommended UX Pattern

For every generated resume bullet, show:

- Original bullet
- Suggested bullet
- Reason for change
- Source experience used
- Accept/reject/edit controls

---

## 14. Security and Privacy Requirements

Even as a local personal project, JobPilot stores sensitive career data.

### Requirements

- Store data in a predictable local app data directory.
- Keep resume files private on the local machine.
- Do not upload resume files except when explicitly used for AI processing.
- Do not store external job board passwords.
- Do not auto-submit applications.
- Allow users to delete resumes, drafts, jobs, and applications.
- Validate uploaded files.
- Limit resume uploads to PDF and DOCX initially.
- Store AI API keys locally and avoid committing them to source control.

### Optional Later Enhancements

- Local passcode or app lock.
- Encrypted local settings.
- Encrypted resume storage.
- Local-only AI mode through Ollama.

---

## 15. Development Roadmap

## Phase 1: Local App Foundation

Goal: Build the desktop app shell and local persistence.

Features:

- Electron setup
- React and TypeScript UI
- SQLite database
- ORM schema
- Local app data directory
- Settings screen
- Basic navigation layout

## Phase 2: Core Tracker

Goal: Build a useful application tracker.

Features:

- Manual job entry
- Application CRUD
- Status tracking
- Table view
- Job detail view
- Notes
- Status history

## Phase 3: Resume and Experience Bank

Goal: Add local resume and verified experience management.

Features:

- Resume upload
- Local file copy/storage
- Resume tagging
- Resume text extraction
- Experience/project CRUD
- Attach resume to application

## Phase 4: AI Matching

Goal: Add AI-assisted job evaluation.

Features:

- Job description parsing
- Resume-job comparison
- Match score
- Strengths and weaknesses
- Missing skills
- Recommended resume
- Local persistence of match analysis

## Phase 5: Resume Tailoring

Goal: Generate tailored resume drafts.

Features:

- Select job and base resume
- Generate suggested changes
- Accept/reject/edit changes
- Save tailored resume draft
- Export Markdown
- Optional DOCX export

## Phase 6: Analytics and Workflow Improvements

Goal: Improve insight and daily usability.

Features:

- Application analytics
- Resume performance tracking
- Stale application detection
- Follow-up reminders
- Recruiter message drafts
- Interview prep generation

## Phase 7: GitHub Job Import

Goal: Import postings from a GitHub repository.

Features:

- Configure repo source
- Manual sync button
- Parse repository job files
- Normalize postings
- Deduplicate jobs
- Import review queue
- Save or ignore imported jobs

## Phase 8: Scheduled Local Sync

Goal: Occasionally pull new job postings automatically.

Features:

- Local scheduled sync
- Track last sync time
- Store source commit
- Notify user of new imported jobs
- Optional automatic AI matching for imported jobs

---

## 16. Portfolio Positioning

JobPilot can be positioned as a serious local-first AI desktop application.

### Technical Areas Demonstrated

- Electron desktop development
- React and TypeScript application design
- Local database design with SQLite
- ORM schema modeling
- Local filesystem storage
- PDF/DOCX text extraction
- AI/LLM integration
- Truth-constrained generation
- Dashboard UX
- Data visualization
- Background import jobs
- GitHub data ingestion
- Privacy-conscious local app architecture

### Example Resume Bullet

```text
Built JobPilot, a local-first Electron job search CRM that tracks applications, manages resume versions, scores job fit with AI, and generates truth-constrained resume drafts from verified experience.
```

### More Technical Resume Bullet

```text
Developed a desktop job search platform using Electron, React, TypeScript, SQLite, and LLM APIs to manage applications, parse resumes, score job fit, and generate tailored resume drafts from local user data.
```

---

## 17. Success Criteria

The project is successful if the user can:

1. Add and manage job postings manually.
2. Track applications through each stage.
3. Upload and manage multiple local resumes.
4. Store verified experience and project facts.
5. Receive useful AI job match explanations.
6. Generate accurate tailored resume suggestions.
7. Export application materials locally.
8. Understand job search progress through analytics.

The MVP is successful if it is better than using a spreadsheet and a folder of resumes.

---

## 18. Final Product Summary

JobPilot is a local-first Electron app for managing a software engineering job search. It centralizes job tracking, resume storage, verified experience, AI job matching, and tailored resume drafting in one desktop workflow.

This version intentionally avoids hosted SaaS complexity. It does not need authentication, cloud storage, production deployment, or multi-user infrastructure. The MVP should focus on manual job entry, local persistence, resume management, and trustworthy AI assistance.

Future job fetching should be added through a GitHub repository import pipeline, beginning with manual sync and later expanding to occasional scheduled local syncs.
