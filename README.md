# JobPilot

JobPilot is a local-first Electron job search CRM. The MVP tracks job applications, stores resumes locally, keeps a verified experience bank, and uses OpenAI for job matching and Markdown resume drafts.

## Development

```bash
npm install
npm run prisma:generate
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Local Data

At runtime the app creates a `JobPilotData` folder inside Electron's user data directory. It stores:

- `jobpilot.db`
- imported resumes
- extracted resume text
- generated drafts
- exported Markdown files

No authentication, cloud storage, hosted database, scraping, or deployment pipeline is required for the MVP.

## New Grad Job Imports

The Imports tab fetches job rows from:

```text
https://raw.githubusercontent.com/speedyapply/2026-SWE-College-Jobs/main/NEW_GRAD_USA.md
```

```
https://raw.githubusercontent.com/SimplifyJobs/New-Grad-Positions/dev/README.md
```

Imported jobs land in a review queue. Use **Save** to create an `Interested` application in the tracker or **Ignore** to hide irrelevant postings. Auto-sync is enabled by default and can be configured in Settings.
