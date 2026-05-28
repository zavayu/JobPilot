import {
  Activity,
  Briefcase,
  Check,
  Database,
  DownloadCloud,
  ExternalLink,
  FileText,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  UserRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { applyTheme } from "./theme";
import {
  APPLICATION_STATUSES,
  ApplicationDTO,
  CreateJobInput,
  DashboardMetrics,
  ExperienceDTO,
  ImportedJobBatchDTO,
  JobImportSourceDTO,
  ImportedJobDTO,
  JobDetailDTO,
  ResumeDTO,
  ResumeDraftDTO,
  SettingsDTO,
  UpsertExperienceInput
} from "../shared/types";

type View = "dashboard" | "jobs" | "imports" | "resumes" | "experience" | "drafts" | "settings";
type ApplicationSortKey = "updated-desc" | "company-asc" | "position-asc" | "status-asc" | "match-desc" | "found-desc";
type ImportedJobSortKey = "seen-desc" | "age-asc" | "company-asc" | "position-asc" | "location-asc" | "category-asc";

const navItems: Array<{ id: View; label: string; icon: typeof Activity }> = [
  { id: "dashboard", label: "Dashboard", icon: Activity },
  { id: "jobs", label: "Applications", icon: Briefcase },
  { id: "imports", label: "Job Listings", icon: DownloadCloud },
  { id: "resumes", label: "Resumes", icon: FileText },
  { id: "experience", label: "Experience", icon: UserRound },
  { id: "drafts", label: "Drafts", icon: FolderOpen },
  { id: "settings", label: "Settings", icon: Settings }
];

const initialJobForm: CreateJobInput = {
  company: "",
  title: "",
  location: "",
  remoteType: "",
  sourceUrl: "",
  description: "",
  employmentType: "",
  status: "Interested",
  notes: ""
};

const initialExperienceForm: UpsertExperienceInput = {
  title: "",
  organization: "",
  description: "",
  technologies: [],
  bullets: [],
  impactMetrics: [],
  tags: []
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function splitList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(value: string[] | undefined): string {
  return value?.join(", ") ?? "";
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function compareText(left?: string | null, right?: string | null): number {
  return (left || "").localeCompare(right || "", undefined, { sensitivity: "base" });
}

function ageToDays(age?: string | null): number {
  const match = age?.trim().match(/^(\d+)\s*([dhm])?/i);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase() ?? "d";
  if (unit === "m") return amount / 1440;
  if (unit === "h") return amount / 24;
  return amount;
}

function importSyncBatches(result: { batches?: ImportedJobBatchDTO[]; batch?: ImportedJobBatchDTO } | null | undefined): ImportedJobBatchDTO[] {
  if (Array.isArray(result?.batches)) {
    return result.batches;
  }
  if (result?.batch) {
    return [result.batch];
  }
  return [];
}

function statusTone(status: string): string {
  if (["Offer"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["Rejected", "Ghosted", "Withdrawn"].includes(status)) return "bg-rose-100 text-rose-800";
  if (["Technical Interview", "Final Interview", "Recruiter Screen", "Online Assessment"].includes(status)) {
    return "bg-sky-100 text-sky-800";
  }
  if (status === "Applied") return "bg-teal-100 text-teal-800";
  return "bg-slate-100 text-slate-700";
}

function priorityTone(priority?: string | null): string {
  if (priority === "high") return "bg-emerald-100 text-emerald-800";
  if (priority === "medium") return "bg-amber-100 text-amber-800";
  if (priority === "low") return "bg-slate-100 text-slate-700";
  return "bg-slate-100 text-slate-500";
}

function Button({
  children,
  icon: Icon,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: typeof Plus;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={classNames(
        "focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition",
        variant === "primary" && "border-primary bg-primary text-primary-foreground hover:bg-teal-700 dark:hover:bg-cyan-300",
        variant === "secondary" && "border-border bg-white text-foreground hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
        variant === "ghost" && "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
        variant === "danger" && "border-rose-200 bg-white text-rose-700 hover:bg-rose-50",
        className
      )}
      {...props}
    >
      {Icon ? <Icon aria-hidden className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className="focus-ring h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground placeholder:text-slate-400 dark:bg-slate-950"
      {...props}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className="focus-ring min-h-24 rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-slate-400 dark:bg-slate-950"
      {...props}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="focus-ring h-10 rounded-md border border-border bg-white px-3 text-sm text-foreground dark:bg-slate-950" {...props} />;
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={classNames("inline-flex items-center rounded-full px-2 py-1 text-xs font-medium", className)}>{children}</span>;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-sm">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-md border border-dashed border-border bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-950">
      <p className="font-medium text-slate-800 dark:text-slate-100">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [applications, setApplications] = useState<ApplicationDTO[]>([]);
  const [importedJobs, setImportedJobs] = useState<ImportedJobDTO[]>([]);
  const [resumes, setResumes] = useState<ResumeDTO[]>([]);
  const [experiences, setExperiences] = useState<ExperienceDTO[]>([]);
  const [drafts, setDrafts] = useState<ResumeDraftDTO[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [settings, setSettings] = useState<SettingsDTO | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetailDTO | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [applicationSort, setApplicationSort] = useState<ApplicationSortKey>("updated-desc");
  const [importFilter, setImportFilter] = useState<"all" | "new" | "saved" | "ignored">("new");
  const [importSourceFilter, setImportSourceFilter] = useState<string>("all");
  const [jobForm, setJobForm] = useState<CreateJobInput>(initialJobForm);
  const [experienceForm, setExperienceForm] = useState<UpsertExperienceInput>(initialExperienceForm);
  const [selectedResumeForAi, setSelectedResumeForAi] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refreshAll() {
    const [nextApplications, nextImportedJobs, nextResumes, nextExperiences, nextDrafts, nextMetrics, nextSettings] = await Promise.all([
      window.jobPilot.jobs.list(),
      window.jobPilot.imports.list(importFilter, importSourceFilter),
      window.jobPilot.resumes.list(),
      window.jobPilot.experiences.list(),
      window.jobPilot.drafts.list(),
      window.jobPilot.analytics.get(),
      window.jobPilot.settings.get()
    ]);
    setApplications(nextApplications);
    setImportedJobs(nextImportedJobs);
    setResumes(nextResumes);
    setExperiences(nextExperiences);
    setDrafts(nextDrafts);
    setMetrics(nextMetrics);
    setSettings(nextSettings);
    if (!selectedResumeForAi && nextResumes[0]) {
      setSelectedResumeForAi(nextResumes[0].id);
    }
  }

  async function runAction<T>(label: string, action: () => Promise<T>, onSuccess?: (value: T) => void) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const value = await action();
      onSuccess?.(value);
      await refreshAll();
      if (selectedJobId) {
        setJobDetail(await window.jobPilot.jobs.getDetail(selectedJobId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    void runAction("Loading", refreshAll);
  }, []);

  useEffect(() => {
    const theme = settings?.theme ?? "dark";
    applyTheme(theme);
  }, [settings?.theme]);

  useEffect(() => {
    if (!selectedJobId) {
      setJobDetail(null);
      return;
    }
    void runAction("Loading job", () => window.jobPilot.jobs.getDetail(selectedJobId), setJobDetail);
  }, [selectedJobId]);

  const filteredApplications = useMemo(() => {
    return applications
      .filter((application) => {
        const haystack =
          `${application.jobPosting?.company} ${application.jobPosting?.title} ${application.jobPosting?.location} ${application.resume?.title}`.toLowerCase();
        const matchesSearch = haystack.includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || application.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((left, right) => {
        if (applicationSort === "company-asc") return compareText(left.jobPosting?.company, right.jobPosting?.company);
        if (applicationSort === "position-asc") return compareText(left.jobPosting?.title, right.jobPosting?.title);
        if (applicationSort === "status-asc") return compareText(left.status, right.status);
        if (applicationSort === "match-desc") return (right.matchScore ?? -1) - (left.matchScore ?? -1);
        if (applicationSort === "found-desc") {
          return new Date(right.jobPosting?.dateFound ?? right.createdAt).getTime() - new Date(left.jobPosting?.dateFound ?? left.createdAt).getTime();
        }
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
  }, [applications, search, statusFilter, applicationSort]);

  useEffect(() => {
    window.jobPilot.imports
      .list(importFilter, importSourceFilter)
      .then(setImportedJobs)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [importFilter, importSourceFilter]);

  const selectedApplication = applications.find((application) => application.jobPostingId === selectedJobId) ?? null;
  const activeView = navItems.find((item) => item.id === view);

  async function handleCreateJob(event: FormEvent) {
    event.preventDefault();
    await runAction(
      "Saving job",
      () => window.jobPilot.jobs.create(jobForm),
      (created) => {
        setJobForm(initialJobForm);
        setSelectedJobId(created.jobPostingId);
        setView("jobs");
      }
    );
  }

  async function handleCreateExperience(event: FormEvent) {
    event.preventDefault();
    await runAction("Saving experience", () => window.jobPilot.experiences.create(experienceForm), () => {
      setExperienceForm(initialExperienceForm);
    });
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex h-16 items-center gap-3 border-b border-border px-5 dark:border-slate-800">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">JobPilot</h1>
            <p className="text-xs text-muted-foreground dark:text-slate-400">Local desktop CRM</p>
          </div>
        </div>
        <nav className="grid gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={classNames(
                  "focus-ring flex h-10 items-center gap-3 rounded-md px-3 text-left text-sm font-medium transition",
                  view === item.id
                    ? "bg-accent text-accent-foreground dark:bg-teal-400 dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                )}
                onClick={() => setView(item.id)}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-border p-4 text-xs text-muted-foreground dark:border-slate-800 dark:text-slate-400">
          <p className="font-medium text-slate-700 dark:text-slate-100">{settings?.openAiModel ?? "gpt-4.1-mini"}</p>
          <p>{settings?.openAiApiKeySet ? "OpenAI key configured" : "OpenAI key missing"}</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="flex h-16 items-center justify-between border-b border-border bg-white px-6 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
          <div>
            <h2 className="text-xl font-semibold">{activeView?.label}</h2>
            <p className="text-sm text-muted-foreground dark:text-slate-400">Track applications, find job listings, manage resumes, and generate AI-assisted drafts.</p>
          </div>
          <Button icon={RefreshCw} variant="secondary" onClick={() => void runAction("Refreshing", refreshAll)} disabled={Boolean(busy)}>
            Refresh
          </Button>
        </header>

        <div className="space-y-4 p-6">
          {error ? <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
          {notice ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
          {busy ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-white px-4 py-2 text-sm text-muted-foreground dark:bg-slate-950">
              <Loader2 className="h-4 w-4 animate-spin" />
              {busy}
            </div>
          ) : null}

          {view === "dashboard" ? (
            <DashboardView metrics={metrics} applications={applications} setView={setView} setSelectedJobId={setSelectedJobId} />
          ) : null}

          {view === "jobs" ? (
            <div className="grid grid-cols-[minmax(0,1fr)_440px] gap-4">
              <div className="space-y-4">
                <ApplicationHighlights applications={applications} />
                <Panel
                  title="Application Tracker"
                  action={
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          className="focus-ring h-9 w-56 rounded-md border border-border bg-white pl-9 pr-3 text-sm dark:bg-slate-950"
                          placeholder="Search jobs"
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                        />
                      </div>
                      <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                        <option value="all">All statuses</option>
                        {APPLICATION_STATUSES.map((status) => (
                          <option key={status}>{status}</option>
                        ))}
                      </Select>
                      <Select value={applicationSort} onChange={(event) => setApplicationSort(event.target.value as ApplicationSortKey)}>
                        <option value="updated-desc">Recently updated</option>
                        <option value="found-desc">Recently found</option>
                        <option value="company-asc">Company A-Z</option>
                        <option value="position-asc">Position A-Z</option>
                        <option value="status-asc">Status A-Z</option>
                        <option value="match-desc">Best match</option>
                      </Select>
                    </div>
                  }
                >
                  <ApplicationsTable applications={filteredApplications} selectedJobId={selectedJobId} setSelectedJobId={setSelectedJobId} />
                </Panel>
              </div>
              <JobDetailPanel
                detail={jobDetail}
                application={selectedApplication}
                resumes={resumes}
                selectedResumeForAi={selectedResumeForAi}
                setSelectedResumeForAi={setSelectedResumeForAi}
                busy={busy}
                onUpdateApplication={(applicationId, input) => runAction("Updating application", () => window.jobPilot.applications.update(applicationId, input))}
                onParseJob={(jobPostingId) => runAction("Parsing job", () => window.jobPilot.ai.parseJob(jobPostingId))}
                onMatchJob={(jobPostingId, resumeId) => runAction("Running match analysis", () => window.jobPilot.ai.matchJob(jobPostingId, resumeId))}
                onGenerateDraft={(jobPostingId, resumeId) =>
                  runAction("Generating draft", () => window.jobPilot.ai.generateResumeDraft(jobPostingId, resumeId), () => setView("drafts"))
                }
                onDeleteJob={(jobPostingId) =>
                  runAction("Deleting job", () => window.jobPilot.jobs.delete(jobPostingId), () => {
                    setSelectedJobId(null);
                    setJobDetail(null);
                  })
                }
              />
            </div>
          ) : null}

          {view === "imports" ? (
            <JobListingsView
              importedJobs={importedJobs}
              importFilter={importFilter}
              setImportFilter={setImportFilter}
              importSourceFilter={importSourceFilter}
              setImportSourceFilter={setImportSourceFilter}
              settings={settings}
              busy={busy}
              jobForm={jobForm}
              setJobForm={setJobForm}
              onCreateJob={handleCreateJob}
              onSync={() =>
                runAction("Syncing new grad jobs", () => window.jobPilot.imports.sync(importSourceFilter === "all" ? null : importSourceFilter), (result) => {
                  setImportedJobs(result.recentJobs);
                  const batches = importSyncBatches(result);
                  const totalFound = batches.reduce((sum, batch) => sum + batch.totalFound, 0);
                  const totalNew = batches.reduce((sum, batch) => sum + batch.newJobs, 0);
                  const totalUpdated = batches.reduce((sum, batch) => sum + batch.updatedJobs, 0);
                  const totalDuplicates = batches.reduce((sum, batch) => sum + batch.duplicateJobs, 0);
                  setNotice(
                    `Sync complete: ${totalFound} found, ${totalNew} new, ${totalUpdated} refreshed, ${totalDuplicates} duplicates.`
                  );
                })
              }
              onSave={(importedJobId) =>
                runAction("Saving imported job", () => window.jobPilot.imports.save(importedJobId), (application) => {
                  setSelectedJobId(application.jobPostingId);
                  setView("jobs");
                })
              }
              onIgnore={(importedJobId) => runAction("Ignoring imported job", () => window.jobPilot.imports.ignore(importedJobId))}
            />
          ) : null}

          {view === "resumes" ? (
            <ResumesView
              resumes={resumes}
              busy={busy}
              onImport={() => runAction("Importing resume", () => window.jobPilot.resumes.importResume())}
              onUpdate={(resumeId, input) => runAction("Updating resume", () => window.jobPilot.resumes.update(resumeId, input))}
              onDelete={(resumeId) => runAction("Deleting resume", () => window.jobPilot.resumes.delete(resumeId))}
            />
          ) : null}

          {view === "experience" ? (
            <ExperienceView
              experiences={experiences}
              experienceForm={experienceForm}
              setExperienceForm={setExperienceForm}
              onCreate={handleCreateExperience}
              onDelete={(experienceId) => runAction("Deleting experience", () => window.jobPilot.experiences.delete(experienceId))}
            />
          ) : null}

          {view === "drafts" ? (
            <DraftsView
              drafts={drafts}
              onExport={(draftId) =>
                runAction("Exporting draft", () => window.jobPilot.drafts.exportMarkdown(draftId), (filePath) => {
                  setNotice(`Exported Markdown to ${filePath}`);
                })
              }
            />
          ) : null}

          {view === "settings" ? (
            <SettingsView
              settings={settings}
              onSave={(input) => runAction("Saving settings", () => window.jobPilot.settings.update(input))}
            />
          ) : null}
        </div>
      </main>
    </div>
  );
}

function DashboardView({
  metrics,
  applications,
  setView,
  setSelectedJobId
}: {
  metrics: DashboardMetrics | null;
  applications: ApplicationDTO[];
  setView: (view: View) => void;
  setSelectedJobId: (id: string) => void;
}) {
  const activePipeline = applications.filter((application) =>
    ["Interested", "Applied", "Online Assessment", "Recruiter Screen", "Technical Interview", "Final Interview"].includes(application.status)
  ).length;
  const averageMatch = applications.length
    ? Math.round(applications.reduce((sum, application) => sum + (application.matchScore ?? 0), 0) / applications.filter((app) => app.matchScore).length) || 0
    : 0;
  const contributionActivity = buildContributionActivity(applications);
  const topStatuses = metrics?.byStatus ?? [];
  const totalStatusCount = Math.max(topStatuses.reduce((sum, item) => sum + item.count, 0), 1);
  const stats = [
    { label: "Tracked jobs", value: metrics?.totalJobs ?? 0, detail: `${activePipeline} active`, tone: "from-teal-600 to-cyan-600" },
    { label: "Submitted", value: metrics?.totalApplications ?? 0, detail: `${metrics?.responseRate ?? 0}% response`, tone: "from-indigo-600 to-sky-600" },
    { label: "Interview rate", value: `${metrics?.interviewRate ?? 0}%`, detail: `${metrics?.offerRate ?? 0}% offer`, tone: "from-emerald-600 to-lime-600" },
    { label: "Avg. match", value: `${averageMatch}%`, detail: `${metrics?.totalResumes ?? 0} resumes`, tone: "from-amber-500 to-orange-600" }
  ];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border border-border bg-white text-slate-950 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white">
        <div className="grid grid-cols-[1.3fr_1fr] gap-6 p-6">
          <div>
            <p className="text-sm font-medium text-teal-700 dark:text-cyan-200">Job search dashboard</p>
            <h3 className="mt-2 text-3xl font-semibold">Applications, progress, and response signals in one view.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground dark:text-slate-300">
              Use this page to see where your search stands, which stages are moving, and whether your application package is producing responses.
            </p>
            <div className="mt-5 flex gap-2">
              <Button icon={Briefcase} onClick={() => setView("jobs")}>
                Open Tracker
              </Button>
              <Button icon={DownloadCloud} variant="secondary" onClick={() => setView("imports")}>
                Find Listings
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ConversionGauge label="Response" value={metrics?.responseRate ?? 0} />
            <ConversionGauge label="Interview" value={metrics?.interviewRate ?? 0} />
            <ConversionGauge label="Offer" value={metrics?.offerRate ?? 0} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <section key={stat.label} className="overflow-hidden rounded-lg border border-border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-white">
            <div className={classNames("h-1.5 bg-gradient-to-r", stat.tone)} />
            <div className="p-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_1fr] gap-4">
        <Panel title="Pipeline Distribution">
          {topStatuses.length ? (
            <div className="grid gap-3">
              {topStatuses.map((item) => (
                <div key={item.status}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{item.status}</span>
                    <span className="text-muted-foreground">{item.count}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-teal-600" style={{ width: `${Math.max(6, (item.count / totalStatusCount) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No pipeline data" body="Saved applications will create a status distribution here." />
          )}
        </Panel>
        <Panel title="Application Activity">
          <ContributionGraph activity={contributionActivity} />
        </Panel>
      </div>

      <div className="grid grid-cols-[1.15fr_0.85fr] gap-4">
        <Panel title="Recent Applications">
          {metrics?.recentApplications.length ? (
            <div className="grid gap-3">
              {metrics.recentApplications.map((application) => (
                <button
                  key={application.id}
                  className="focus-ring flex items-center justify-between rounded-md border border-border bg-white px-4 py-3 text-left hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900"
                  onClick={() => {
                    setSelectedJobId(application.jobPostingId);
                    setView("jobs");
                  }}
                >
                  <span>
                    <span className="block text-sm font-medium">
                      {application.jobPosting?.company} · {application.jobPosting?.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Updated {formatDate(application.updatedAt)}
                      {application.matchScore ? ` · ${application.matchScore}% match` : ""}
                    </span>
                  </span>
                  <Badge className={statusTone(application.status)}>{application.status}</Badge>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title="No applications yet" body="Add a job manually to start tracking your search." />
          )}
        </Panel>
        <Panel title="Search Assets">
          <div className="grid gap-3">
            <div className="rounded-md border border-border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-medium">Resume bank</p>
              <p className="mt-1 text-2xl font-semibold">{metrics?.totalResumes ?? 0}</p>
              <p className="text-xs text-muted-foreground">Stored versions ready for matching.</p>
            </div>
            <div className="rounded-md border border-border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-medium">Verified experience</p>
              <p className="mt-1 text-2xl font-semibold">{metrics?.totalExperiences ?? 0}</p>
              <p className="text-xs text-muted-foreground">Facts available for tailored drafts.</p>
            </div>
            <div className="rounded-md border border-border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-sm font-medium">Tracked outcomes</p>
              <p className="mt-1 text-2xl font-semibold">{applications.filter((app) => ["Offer", "Rejected", "Ghosted"].includes(app.status)).length}</p>
              <p className="text-xs text-muted-foreground">Closed-loop results for search quality.</p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

type ContributionDay = {
  date: Date;
  count: number;
  level: number;
};

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildContributionActivity(applications: ApplicationDTO[]) {
  const counts = new Map<string, number>();
  for (const application of applications) {
    const date = startOfDay(new Date(application.dateApplied ?? application.createdAt));
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = startOfDay(new Date());
  const start = new Date(today);
  start.setDate(start.getDate() - 364);
  start.setDate(start.getDate() - start.getDay());

  const weeks: ContributionDay[][] = [];
  for (let weekIndex = 0; weekIndex < 53; weekIndex += 1) {
    const week: ContributionDay[] = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + weekIndex * 7 + dayIndex);
      const count = date <= today ? counts.get(dayKey(date)) ?? 0 : 0;
      week.push({
        date,
        count,
        level: count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 3 : 4
      });
    }
    weeks.push(week);
  }

  const monthLabels: Array<{ label: string; column: number }> = [];
  let previousMonth = -1;
  weeks.forEach((week, column) => {
    const firstVisibleDate = week.find((day) => day.date <= today)?.date;
    if (!firstVisibleDate) {
      return;
    }
    const month = firstVisibleDate.getMonth();
    if (month !== previousMonth && firstVisibleDate.getDate() <= 7) {
      monthLabels.push({
        label: firstVisibleDate.toLocaleDateString(undefined, { month: "short" }),
        column
      });
      previousMonth = month;
    }
  });

  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  return { weeks, monthLabels, total };
}

function ContributionGraph({ activity }: { activity: ReturnType<typeof buildContributionActivity> }) {
  const colorByLevel = [
    "bg-slate-100 dark:bg-slate-800",
    "bg-emerald-200 dark:bg-emerald-950",
    "bg-emerald-400 dark:bg-emerald-800",
    "bg-emerald-500 dark:bg-emerald-600",
    "bg-emerald-700 dark:bg-emerald-400"
  ];

  return (
    <div className="rounded-md border border-border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium">{activity.total} application events in the last year</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className={classNames("h-3 w-3 rounded-sm", colorByLevel[level])} />
          ))}
          <span>More</span>
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[780px]">
          <div className="relative ml-9 h-5">
            {activity.monthLabels.map((month) => (
              <span
                key={`${month.label}-${month.column}`}
                className="absolute text-xs text-muted-foreground"
                style={{ left: `${month.column * 14}px` }}
              >
                {month.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-[28px_1fr] gap-2">
            <div className="grid grid-rows-7 gap-1 text-xs text-muted-foreground">
              <span />
              <span>Mon</span>
              <span />
              <span>Wed</span>
              <span />
              <span>Fri</span>
              <span />
            </div>
            <div className="grid grid-flow-col grid-rows-7 gap-1">
              {activity.weeks.flatMap((week, weekIndex) =>
                week.map((day, dayIndex) => (
                  <span
                    key={`${weekIndex}-${dayIndex}`}
                    className={classNames("h-3 w-3 rounded-sm", colorByLevel[day.level])}
                    title={`${day.count} application event${day.count === 1 ? "" : "s"} on ${day.date.toLocaleDateString()}`}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversionGauge({ label, value }: { label: string; value: number }) {
  const normalized = Math.max(0, Math.min(value, 100));
  const circumference = 2 * Math.PI * 34;
  const offset = circumference - (normalized / 100) * circumference;

  return (
    <div className="rounded-lg border border-white/10 bg-white/10 p-4 text-center">
      <svg viewBox="0 0 84 84" className="mx-auto h-20 w-20">
        <circle cx="42" cy="42" r="34" fill="none" stroke="rgb(51 65 85)" strokeWidth="8" />
        <circle
          cx="42"
          cy="42"
          r="34"
          fill="none"
          stroke="rgb(45 212 191)"
          strokeLinecap="round"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 42 42)"
        />
        <text x="42" y="47" textAnchor="middle" className="fill-white text-base font-semibold">
          {normalized}%
        </text>
      </svg>
      <p className="mt-2 text-sm font-medium text-slate-200">{label}</p>
    </div>
  );
}

function ApplicationsTable({
  applications,
  selectedJobId,
  setSelectedJobId
}: {
  applications: ApplicationDTO[];
  selectedJobId: string | null;
  setSelectedJobId: (id: string) => void;
}) {
  if (!applications.length) {
    return <EmptyState title="No jobs found" body="Add a job or adjust your filters." />;
  }
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-300">
          <tr>
            <th className="px-3 py-3">Company</th>
            <th className="px-3 py-3">Position</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Location</th>
            <th className="px-3 py-3">Resume</th>
            <th className="px-3 py-3">Match</th>
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <tr
              key={application.id}
              className={classNames(
                "cursor-pointer border-t border-border hover:bg-slate-50 dark:hover:bg-slate-900",
                selectedJobId === application.jobPostingId && "bg-accent/60"
              )}
              onClick={() => setSelectedJobId(application.jobPostingId)}
            >
              <td className="px-3 py-3 font-medium">{application.jobPosting?.company}</td>
              <td className="px-3 py-3">{application.jobPosting?.title}</td>
              <td className="px-3 py-3">
                <Badge className={statusTone(application.status)}>{application.status}</Badge>
              </td>
              <td className="px-3 py-3 text-muted-foreground">{application.jobPosting?.location || "Not set"}</td>
              <td className="px-3 py-3 text-muted-foreground">{application.resume?.title || "None"}</td>
              <td className="px-3 py-3">
                {application.matchScore ? <span className="font-semibold">{application.matchScore}%</span> : <span className="text-muted-foreground">-</span>}
              </td>
              <td className="px-3 py-3">
                {application.jobPosting?.sourceUrl ? (
                  <a
                    className="focus-ring inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    href={application.jobPosting.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApplicationHighlights({ applications }: { applications: ApplicationDTO[] }) {
  const interested = applications.filter((application) => application.status === "Interested").length;
  const applied = applications.filter((application) => application.status === "Applied").length;
  const interviewing = applications.filter((application) =>
    ["Online Assessment", "Recruiter Screen", "Technical Interview", "Final Interview"].includes(application.status)
  ).length;
  const outcomes = applications.filter((application) => ["Offer", "Rejected", "Ghosted", "Withdrawn"].includes(application.status)).length;

  return (
    <div className="grid grid-cols-4 gap-3">
      <Metric label="Interested" value={String(interested)} />
      <Metric label="Applied" value={String(applied)} />
      <Metric label="Interviewing" value={String(interviewing)} />
      <Metric label="Outcomes" value={String(outcomes)} />
    </div>
  );
}

function JobDetailPanel({
  detail,
  application,
  resumes,
  selectedResumeForAi,
  setSelectedResumeForAi,
  busy,
  onUpdateApplication,
  onParseJob,
  onMatchJob,
  onGenerateDraft,
  onDeleteJob
}: {
  detail: JobDetailDTO | null;
  application: ApplicationDTO | null;
  resumes: ResumeDTO[];
  selectedResumeForAi: string;
  setSelectedResumeForAi: (id: string) => void;
  busy: string | null;
  onUpdateApplication: (applicationId: string, input: any) => void;
  onParseJob: (jobPostingId: string) => void;
  onMatchJob: (jobPostingId: string, resumeId?: string | null) => void;
  onGenerateDraft: (jobPostingId: string, resumeId: string) => void;
  onDeleteJob: (jobPostingId: string) => void;
}) {
  if (!detail || !application) {
    return (
      <Panel title="Job Detail">
        <EmptyState title="Select a job" body="Choose a row in the tracker to inspect status, AI analysis, notes, and drafts." />
      </Panel>
    );
  }

  const latestMatch = detail.matches[0];
  return (
    <Panel title="Job Detail" action={<Button icon={Trash2} variant="danger" onClick={() => onDeleteJob(detail.job.id)}>Delete</Button>}>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">{detail.job.title}</h3>
          <p className="text-sm text-muted-foreground">
            {detail.job.company} · {detail.job.location || "Location not set"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={application.status} onChange={(event) => onUpdateApplication(application.id, { status: event.target.value })}>
              {APPLICATION_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </Select>
          </Field>
          <Field label="Resume Used">
            <Select
              value={application.resumeId ?? ""}
              onChange={(event) => onUpdateApplication(application.id, { resumeId: event.target.value || null })}
            >
              <option value="">None</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Notes">
          <TextArea
            value={application.notes ?? ""}
            onChange={(event) => onUpdateApplication(application.id, { notes: event.target.value })}
          />
        </Field>
        <div className="grid gap-2">
          <p className="text-sm font-medium">AI Actions</p>
          <div className="flex flex-wrap gap-2">
            <Button icon={Sparkles} variant="secondary" disabled={Boolean(busy)} onClick={() => onParseJob(detail.job.id)}>
              Parse Job
            </Button>
            <Select value={selectedResumeForAi} onChange={(event) => setSelectedResumeForAi(event.target.value)}>
              <option value="">Auto-select resume</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.title}
                </option>
              ))}
            </Select>
            <Button icon={Sparkles} disabled={Boolean(busy)} onClick={() => onMatchJob(detail.job.id, selectedResumeForAi || null)}>
              Match
            </Button>
            <Button
              icon={FileText}
              variant="secondary"
              disabled={Boolean(busy) || !selectedResumeForAi}
              onClick={() => onGenerateDraft(detail.job.id, selectedResumeForAi)}
            >
              Draft
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-border bg-slate-50 p-3 dark:bg-slate-950">
          <p className="text-sm font-medium">Parsed Keywords</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {detail.job.technologies.length ? (
              detail.job.technologies.map((tech) => (
                <Badge key={tech} className="bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {tech}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Run Parse Job to extract technologies.</span>
            )}
          </div>
        </div>
        {latestMatch ? (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">Latest Match Analysis</p>
              <div className="flex gap-2">
                <Badge className="bg-teal-100 text-teal-800">{latestMatch.score}%</Badge>
                <Badge className={priorityTone(latestMatch.applicationPriority)}>{latestMatch.applicationPriority || "priority not set"}</Badge>
              </div>
            </div>
            <AnalysisList title="Strengths" values={latestMatch.strengths} />
            <AnalysisList title="Weaknesses" values={latestMatch.weaknesses} />
            <AnalysisList title="Missing Skills" values={latestMatch.missingSkills} />
            <AnalysisList title="Suggested Changes" values={latestMatch.suggestedChanges} />
          </div>
        ) : (
          <EmptyState title="No match analysis yet" body="Configure OpenAI in Settings, import a resume, then run Match." />
        )}
        <details className="rounded-md border border-border bg-white p-3 dark:bg-slate-950">
          <summary className="cursor-pointer text-sm font-medium">Job Description</summary>
          <p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{detail.job.description}</p>
        </details>
      </div>
    </Panel>
  );
}

function AnalysisList({ title, values }: { title: string; values: string[] }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {values.length ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">None recorded.</p>
      )}
    </div>
  );
}

function ManualJobDialog({
  open,
  onClose,
  jobForm,
  setJobForm,
  onCreateJob,
  busy
}: {
  open: boolean;
  onClose: () => void;
  jobForm: CreateJobInput;
  setJobForm: (input: CreateJobInput) => void;
  onCreateJob: (event: FormEvent) => Promise<void>;
  busy: string | null;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-6 py-8">
      <div className="max-h-full w-full max-w-3xl overflow-auto rounded-lg border border-border bg-white shadow-xl dark:bg-card">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-950 dark:text-white">
          <h2 className="text-base font-semibold">Add Job Manually</h2>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <form
          className="grid gap-4 p-5"
          onSubmit={async (event) => {
            await onCreateJob(event);
            onClose();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company">
              <TextInput required value={jobForm.company} onChange={(event) => setJobForm({ ...jobForm, company: event.target.value })} />
            </Field>
            <Field label="Position">
              <TextInput required value={jobForm.title} onChange={(event) => setJobForm({ ...jobForm, title: event.target.value })} />
            </Field>
            <Field label="Location">
              <TextInput value={jobForm.location} onChange={(event) => setJobForm({ ...jobForm, location: event.target.value })} />
            </Field>
            <Field label="Initial Status">
              <Select value={jobForm.status} onChange={(event) => setJobForm({ ...jobForm, status: event.target.value })}>
                <option>Interested</option>
                <option>Applied</option>
              </Select>
            </Field>
            <Field label="Application URL">
              <TextInput value={jobForm.sourceUrl} onChange={(event) => setJobForm({ ...jobForm, sourceUrl: event.target.value })} />
            </Field>
            <Field label="Employment Type">
              <TextInput value={jobForm.employmentType} onChange={(event) => setJobForm({ ...jobForm, employmentType: event.target.value })} />
            </Field>
          </div>
          <Field label="Job Description">
            <TextArea required value={jobForm.description} onChange={(event) => setJobForm({ ...jobForm, description: event.target.value })} />
          </Field>
          <Field label="Notes">
            <TextInput value={jobForm.notes} onChange={(event) => setJobForm({ ...jobForm, notes: event.target.value })} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button icon={Plus} type="submit" disabled={Boolean(busy)}>
              Add to Applications
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JobListingsView({
  importedJobs,
  importFilter,
  setImportFilter,
  importSourceFilter,
  setImportSourceFilter,
  settings,
  busy,
  jobForm,
  setJobForm,
  onCreateJob,
  onSync,
  onSave,
  onIgnore
}: {
  importedJobs: ImportedJobDTO[];
  importFilter: "all" | "new" | "saved" | "ignored";
  setImportFilter: (filter: "all" | "new" | "saved" | "ignored") => void;
  importSourceFilter: string;
  setImportSourceFilter: (sourceId: string) => void;
  settings: SettingsDTO | null;
  busy: string | null;
  jobForm: CreateJobInput;
  setJobForm: (input: CreateJobInput) => void;
  onCreateJob: (event: FormEvent) => Promise<void>;
  onSync: () => void;
  onSave: (importedJobId: string) => void;
  onIgnore: (importedJobId: string) => void;
}) {
  const [importSearch, setImportSearch] = useState("");
  const [importSort, setImportSort] = useState<ImportedJobSortKey>("seen-desc");
  const [isManualJobOpen, setIsManualJobOpen] = useState(false);
  const sources = settings?.jobImportSources ?? [];

  const visibleImportedJobs = useMemo(() => {
    return importedJobs
      .filter((job) => {
        const haystack = `${job.company} ${job.title} ${job.location} ${job.category} ${job.salary ?? ""} ${job.sourceName}`.toLowerCase();
        return haystack.includes(importSearch.toLowerCase());
      })
      .sort((left, right) => {
        if (importSort === "age-asc") return ageToDays(left.age) - ageToDays(right.age);
        if (importSort === "company-asc") return compareText(left.company, right.company);
        if (importSort === "position-asc") return compareText(left.title, right.title);
        if (importSort === "location-asc") return compareText(left.location, right.location);
        if (importSort === "category-asc") return compareText(left.category, right.category);
        return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
      });
  }, [importedJobs, importSearch, importSort]);

  const counts = importedJobs.reduce(
    (acc, job) => {
      acc[job.status] = (acc[job.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-4">
      <ManualJobDialog
        open={isManualJobOpen}
        onClose={() => setIsManualJobOpen(false)}
        jobForm={jobForm}
        setJobForm={setJobForm}
        onCreateJob={onCreateJob}
        busy={busy}
      />
      <Panel
      title="Found Job Listings"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button icon={Plus} variant="secondary" onClick={() => setIsManualJobOpen(true)}>
            Add Job
          </Button>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="focus-ring h-9 w-64 rounded-md border border-border bg-white pl-9 pr-3 text-sm dark:bg-slate-950"
              placeholder="Search imports"
              value={importSearch}
              onChange={(event) => setImportSearch(event.target.value)}
            />
          </div>
          <Select value={importFilter} onChange={(event) => setImportFilter(event.target.value as "all" | "new" | "saved" | "ignored")}>
            <option value="new">New</option>
            <option value="saved">Saved</option>
            <option value="ignored">Ignored</option>
            <option value="all">All</option>
          </Select>
          <Select value={importSourceFilter} onChange={(event) => setImportSourceFilter(event.target.value)}>
            <option value="all">All sources</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
          <Select value={importSort} onChange={(event) => setImportSort(event.target.value as ImportedJobSortKey)}>
            <option value="seen-desc">Recently seen</option>
            <option value="age-asc">Newest posting age</option>
            <option value="company-asc">Company A-Z</option>
            <option value="position-asc">Position A-Z</option>
            <option value="location-asc">Location A-Z</option>
            <option value="category-asc">Category A-Z</option>
          </Select>
          <Button icon={DownloadCloud} onClick={onSync} disabled={Boolean(busy)}>
            Sync Now
          </Button>
        </div>
      }
      >
      <div className="mb-4 grid grid-cols-4 gap-3">
        <Metric label="Visible jobs" value={String(visibleImportedJobs.length)} />
        <Metric label="New" value={String(counts.new ?? 0)} />
        <Metric label="Saved" value={String(counts.saved ?? 0)} />
        <Metric label="Duplicates/ignored" value={String(counts.ignored ?? 0)} />
      </div>
      <div className="mb-4 rounded-md border border-border bg-slate-50 p-3 text-sm text-muted-foreground dark:bg-slate-950">
        <p className="font-medium text-slate-700 dark:text-slate-100">Sources</p>
        <div className="mt-2 grid gap-2">
          {sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2 dark:bg-slate-900">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-100">{source.name}</p>
                <p className="break-all text-xs">{source.url}</p>
              </div>
              <Badge className={source.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}>
                {source.enabled ? "enabled" : "disabled"}
              </Badge>
            </div>
          ))}
        </div>
        <p className="mt-1">
          Auto-sync {settings?.jobAutoSyncEnabled ? `enabled every ${settings.jobAutoSyncIntervalHours}h` : "disabled"}
          {settings?.lastJobImportAt ? ` · Last sync ${formatDate(settings.lastJobImportAt)}` : ""}
        </p>
      </div>
      {visibleImportedJobs.length ? (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-300">
              <tr>
                <th className="px-3 py-3">Company</th>
                <th className="px-3 py-3">Position</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Age</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleImportedJobs.map((job) => (
                <tr key={job.id} className="border-t border-border">
                  <td className="px-3 py-3 font-medium">{job.company}</td>
                  <td className="px-3 py-3">
                    <div className="max-w-xl">
                      <p>{job.title}</p>
                      {job.salary ? <p className="mt-1 text-xs text-muted-foreground">{job.salary}</p> : null}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{job.location || "Not set"}</td>
                  <td className="px-3 py-3">{job.category}</td>
                  <td className="px-3 py-3 text-muted-foreground">{sources.find((source) => source.id === job.sourceName)?.name ?? job.sourceName}</td>
                  <td className="px-3 py-3 text-muted-foreground">{job.age || "-"}</td>
                  <td className="px-3 py-3">
                    <Badge className={job.status === "saved" ? "bg-emerald-100 text-emerald-800" : job.status === "ignored" ? "bg-slate-100 text-slate-600" : "bg-sky-100 text-sky-800"}>
                      {job.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <a
                        className="focus-ring inline-flex h-9 items-center justify-center rounded-md border border-border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                        href={job.postingUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <Button icon={Plus} disabled={job.status === "saved"} onClick={() => onSave(job.id)}>
                        Save
                      </Button>
                      <Button icon={Trash2} variant="secondary" disabled={job.status === "ignored"} onClick={() => onIgnore(job.id)}>
                        Ignore
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No imported jobs found" body="Run Sync Now, adjust the status filter, or clear the search query." />
      )}
      </Panel>
    </div>
  );
}

function ResumesView({
  resumes,
  busy,
  onImport,
  onUpdate,
  onDelete
}: {
  resumes: ResumeDTO[];
  busy: string | null;
  onImport: () => void;
  onUpdate: (resumeId: string, input: any) => void;
  onDelete: (resumeId: string) => void;
}) {
  return (
    <Panel title="Resume Bank" action={<Button icon={Upload} onClick={onImport} disabled={Boolean(busy)}>Import PDF/DOCX</Button>}>
      {resumes.length ? (
        <div className="grid gap-3">
          {resumes.map((resume) => (
            <ResumeRow key={resume.id} resume={resume} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </div>
      ) : (
        <EmptyState title="No resumes imported" body="Import a PDF or DOCX resume to enable AI matching and resume drafts." />
      )}
    </Panel>
  );
}

function ResumeRow({
  resume,
  onUpdate,
  onDelete
}: {
  resume: ResumeDTO;
  onUpdate: (resumeId: string, input: any) => void;
  onDelete: (resumeId: string) => void;
}) {
  const [title, setTitle] = useState(resume.title);
  const [targetRole, setTargetRole] = useState(resume.targetRole ?? "");
  const [tags, setTags] = useState(joinList(resume.tags));
  return (
    <div className="rounded-md border border-border p-4">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] gap-3">
        <TextInput value={title} onChange={(event) => setTitle(event.target.value)} />
        <TextInput placeholder="Target role" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} />
        <TextInput placeholder="Tags" value={tags} onChange={(event) => setTags(event.target.value)} />
        <Button icon={Save} variant="secondary" onClick={() => onUpdate(resume.id, { title, targetRole, tags: splitList(tags) })}>
          Save
        </Button>
        <Button icon={Trash2} variant="danger" onClick={() => onDelete(resume.id)}>
          Delete
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {resume.originalFileName} · {resume.fileType.toUpperCase()} · {resume.extractedText?.length ?? 0} extracted characters
      </p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium">Extracted text preview</summary>
        <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
          {resume.extractedText || "No extracted text available."}
        </p>
      </details>
    </div>
  );
}

function ExperienceView({
  experiences,
  experienceForm,
  setExperienceForm,
  onCreate,
  onDelete
}: {
  experiences: ExperienceDTO[];
  experienceForm: UpsertExperienceInput;
  setExperienceForm: (input: UpsertExperienceInput) => void;
  onCreate: (event: FormEvent) => void;
  onDelete: (experienceId: string) => void;
}) {
  return (
    <div className="grid grid-cols-[420px_minmax(0,1fr)] gap-4">
      <Panel title="Add Verified Experience">
        <form className="grid gap-3" onSubmit={onCreate}>
          <Field label="Title">
            <TextInput required value={experienceForm.title} onChange={(event) => setExperienceForm({ ...experienceForm, title: event.target.value })} />
          </Field>
          <Field label="Organization">
            <TextInput
              value={experienceForm.organization ?? ""}
              onChange={(event) => setExperienceForm({ ...experienceForm, organization: event.target.value })}
            />
          </Field>
          <Field label="Technologies">
            <TextInput
              value={joinList(experienceForm.technologies)}
              onChange={(event) => setExperienceForm({ ...experienceForm, technologies: splitList(event.target.value) })}
            />
          </Field>
          <Field label="Verified Bullets">
            <TextArea
              placeholder="One bullet per line"
              value={joinList(experienceForm.bullets)}
              onChange={(event) => setExperienceForm({ ...experienceForm, bullets: splitList(event.target.value) })}
            />
          </Field>
          <Field label="Impact Metrics">
            <TextArea
              placeholder="One metric per line"
              value={joinList(experienceForm.impactMetrics)}
              onChange={(event) => setExperienceForm({ ...experienceForm, impactMetrics: splitList(event.target.value) })}
            />
          </Field>
          <Field label="Description">
            <TextArea
              value={experienceForm.description ?? ""}
              onChange={(event) => setExperienceForm({ ...experienceForm, description: event.target.value })}
            />
          </Field>
          <Button icon={Plus} type="submit">
            Add Experience
          </Button>
        </form>
      </Panel>
      <Panel title="Experience Bank">
        {experiences.length ? (
          <div className="grid gap-3">
            {experiences.map((experience) => (
              <div key={experience.id} className="rounded-md border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{experience.title}</h3>
                    <p className="text-sm text-muted-foreground">{experience.organization || "No organization"}</p>
                  </div>
                  <Button icon={Trash2} variant="danger" onClick={() => onDelete(experience.id)}>
                    Delete
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {experience.technologies.map((tech) => (
                    <Badge key={tech} className="bg-slate-100 text-slate-700">
                      {tech}
                    </Badge>
                  ))}
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {experience.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No verified experience yet" body="Add projects, internships, coursework, and resume-safe facts before generating drafts." />
        )}
      </Panel>
    </div>
  );
}

function DraftsView({ drafts, onExport }: { drafts: ResumeDraftDTO[]; onExport: (draftId: string) => void }) {
  return (
    <Panel title="Resume Drafts">
      {drafts.length ? (
        <div className="grid gap-4">
          {drafts.map((draft) => (
            <div key={draft.id} className="rounded-md border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{draft.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {draft.jobPosting?.company} · {draft.baseResume?.title} · {formatDate(draft.updatedAt)}
                  </p>
                </div>
                <Button icon={FolderOpen} variant="secondary" onClick={() => onExport(draft.id)}>
                  Export Markdown
                </Button>
              </div>
              <div className="mt-3 rounded-md bg-slate-950 p-4 text-sm text-slate-100">
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap">{draft.content}</pre>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No drafts yet" body="Open a job detail, select a resume, and generate a tailored Markdown draft." />
      )}
    </Panel>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-slate-50 p-4 dark:bg-slate-950">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function SettingsView({
  settings,
  onSave
}: {
  settings: SettingsDTO | null;
  onSave: (input: {
    openAiApiKey?: string;
    openAiModel?: string;
    theme?: "light" | "dark";
    jobImportUrl?: string;
    jobImportSources?: JobImportSourceDTO[];
    jobAutoSyncEnabled?: boolean;
    jobAutoSyncIntervalHours?: number;
  }) => void;
}) {
  const [apiKey, setApiKey] = useState(settings?.openAiApiKey ?? "");
  const [model, setModel] = useState(settings?.openAiModel ?? "gpt-4.1-mini");
  const [theme, setTheme] = useState<"light" | "dark">(settings?.theme ?? "dark");
  const [jobImportUrl, setJobImportUrl] = useState(settings?.jobImportUrl ?? "");
  const [jobImportSources, setJobImportSources] = useState<JobImportSourceDTO[]>(settings?.jobImportSources ?? []);
  const [jobAutoSyncEnabled, setJobAutoSyncEnabled] = useState(settings?.jobAutoSyncEnabled ?? true);
  const [jobAutoSyncIntervalHours, setJobAutoSyncIntervalHours] = useState(settings?.jobAutoSyncIntervalHours ?? 6);

  useEffect(() => {
    setApiKey(settings?.openAiApiKey ?? "");
    setModel(settings?.openAiModel ?? "gpt-4.1-mini");
    setTheme(settings?.theme ?? "dark");
    setJobImportUrl(settings?.jobImportUrl ?? "");
    setJobImportSources(settings?.jobImportSources ?? []);
    setJobAutoSyncEnabled(settings?.jobAutoSyncEnabled ?? true);
    setJobAutoSyncIntervalHours(settings?.jobAutoSyncIntervalHours ?? 6);
  }, [settings]);

  return (
    <Panel title="Local Settings">
      <div className="grid max-w-2xl gap-4">
        <Field label="OpenAI API Key">
          <TextInput type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." />
        </Field>
        <Field label="OpenAI Model">
          <TextInput value={model} onChange={(event) => setModel(event.target.value)} />
        </Field>
        <Field label="Theme">
          <Select
            value={theme}
            onChange={(event) => {
              const nextTheme = event.target.value as "light" | "dark";
              setTheme(nextTheme);
              applyTheme(nextTheme);
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </Select>
        </Field>
        <div className="grid gap-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Job Sources</p>
          {jobImportSources.map((source, index) => (
            <div key={source.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-md border border-border bg-slate-50 p-3 dark:bg-slate-950">
              <div className="grid gap-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-100">{source.name}</p>
                <TextInput
                  value={source.url}
                  onChange={(event) => {
                    const nextSources = [...jobImportSources];
                    nextSources[index] = { ...source, url: event.target.value };
                    setJobImportSources(nextSources);
                    if (source.id === "speedyapply_new_grad_usa") {
                      setJobImportUrl(event.target.value);
                    }
                  }}
                />
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={source.enabled}
                  onChange={(event) => {
                    const nextSources = [...jobImportSources];
                    nextSources[index] = { ...source, enabled: event.target.checked };
                    setJobImportSources(nextSources);
                  }}
                  className="h-4 w-4 accent-teal-700"
                />
                Enabled
              </label>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_180px] gap-3">
          <label className="flex items-center gap-3 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-950 dark:text-slate-200">
            <input
              type="checkbox"
              checked={jobAutoSyncEnabled}
              onChange={(event) => setJobAutoSyncEnabled(event.target.checked)}
              className="h-4 w-4 accent-teal-700"
            />
            Auto-sync imported jobs
          </label>
          <Field label="Interval hours">
            <TextInput
              type="number"
              min={1}
              value={jobAutoSyncIntervalHours}
              onChange={(event) => setJobAutoSyncIntervalHours(Number(event.target.value) || 1)}
            />
          </Field>
        </div>
        <div className="rounded-md border border-border bg-slate-50 p-3 text-sm dark:bg-slate-950">
          <div className="flex items-center gap-2 font-medium">
            <Database className="h-4 w-4" />
            Local data directory
          </div>
          <p className="mt-1 break-all text-muted-foreground">{settings?.dataDirectory ?? "Loading..."}</p>
        </div>
        <Button
          icon={Check}
          onClick={() =>
            onSave({
              openAiApiKey: apiKey,
              openAiModel: model,
              theme,
              jobImportUrl,
              jobImportSources,
              jobAutoSyncEnabled,
              jobAutoSyncIntervalHours
            })
          }
        >
          Save Settings
        </Button>
      </div>
    </Panel>
  );
}
