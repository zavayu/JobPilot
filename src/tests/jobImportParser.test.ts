import { describe, expect, it } from "vitest";
import { canonicalizePostingUrl, importedJobDescription, parseNewGradMarkdown, parseSimplifyMarkdown } from "../main/jobImportParser";

describe("new grad GitHub job parser", () => {
  it("parses FAANG rows with salary and Other rows without salary", () => {
    const markdown = `
<!-- TABLE_FAANG_START -->
| Company | Position | Location | Salary | Posting | Age |
|---|---|---|---|---|---|
| <a href="https://www.google.com"><strong>Google</strong></a> | Forward Deployed Engineer I - Applied AI - Google Cloud | San Francisco, CA, USA | $216k/yr | <a href="https://www.google.com/about/careers/applications/jobs/results/114621883831198406"><img src="apply.png" alt="Apply"/></a> | 2d |
<!-- TABLE_FAANG_END -->

<!-- TABLE_START -->
| Company | Position | Location | Posting | Age |
|---|---|---|---|---|
| <a href="https://boeing.com/"><strong>Boeing</strong></a> | Associate Software Engineer | USA Berkeley, MO | <a href="https://boeing.wd1.myworkdayjobs.com/en-US/external/job/USA---Berkeley-MO/Associate-Software-Engineer_JR2026511832"><img src="apply.png" alt="Apply"/></a> | 1d |
<!-- TABLE_END -->
`;

    const jobs = parseNewGradMarkdown(markdown);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      company: "Google",
      companyUrl: "https://www.google.com",
      title: "Forward Deployed Engineer I - Applied AI - Google Cloud",
      salary: "$216k/yr",
      category: "FAANG+",
      age: "2d"
    });
    expect(jobs[1]).toMatchObject({
      company: "Boeing",
      salary: null,
      category: "Other",
      postingUrl: "https://boeing.wd1.myworkdayjobs.com/en-US/external/job/USA---Berkeley-MO/Associate-Software-Engineer_JR2026511832"
    });
    expect(jobs[0].sourceKey).not.toEqual(jobs[1].sourceKey);
  });

  it("builds a tracker-safe description from imported metadata", () => {
    const description = importedJobDescription({
      category: "Other",
      age: "1d",
      salary: null,
      rawMarkdown: "| raw | row |",
      sourceRepo: "speedyapply/2026-SWE-College-Jobs"
    });

    expect(description).toContain("Imported from speedyapply/2026-SWE-College-Jobs");
    expect(description).toContain("Category: Other");
    expect(description).toContain("| raw | row |");
  });

  it("parses Simplify new grad rows and preserves the category", () => {
    const markdown = `
## Software Engineering New Grad Roles

| Company | Role | Location | Application | Age |
|---|---|---|---|---|
| <a href="https://acme.com"><strong>Acme</strong></a> | Software Engineer, New Grad | New York, NY | <a href="https://boards.greenhouse.io/acme/jobs/123456?utm_source=simplify"><img src="apply.png" /></a> | 1d |
`;

    const jobs = parseSimplifyMarkdown(markdown);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      company: "Acme",
      title: "Software Engineer, New Grad",
      location: "New York, NY",
      category: "Software Engineering",
      canonicalUrl: "https://boards.greenhouse.io/acme/jobs/123456"
    });
    expect(jobs[0].dedupeKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it("parses Simplify HTML table rows", () => {
    const markdown = `
## 💻 Software Engineering New Grad Roles

<table>
<tbody>
<tr>
<td><strong><a href="https://simplify.jobs/c/Amazon?utm_source=GHList&utm_medium=company">🔥 Amazon</a></strong></td>
<td>Software Engineer 1</td>
<td>Seattle, WA</br>SF</td>
<td><div align="center"><a href="https://amazon.jobs/en/jobs/3141336/software-engineer-i?utm_source=Simplify&ref=Simplify"><img src="apply.png" alt="Apply"></a> <a href="https://simplify.jobs/p/abc?utm_source=GHList"><img src="simplify.png" alt="Simplify"></a></div></td>
<td>0d</td>
</tr>
</tbody>
</table>
`;

    const jobs = parseSimplifyMarkdown(markdown);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      company: "Amazon",
      title: "Software Engineer 1",
      location: "Seattle, WA SF",
      category: "Software Engineering",
      postingUrl: "https://amazon.jobs/en/jobs/3141336/software-engineer-i?utm_source=Simplify&ref=Simplify",
      canonicalUrl: "https://amazon.jobs/en/jobs/3141336/software-engineer-i"
    });
  });

  it("canonicalizes posting URLs by removing tracking noise", () => {
    expect(canonicalizePostingUrl("https://Boards.Greenhouse.io/acme/jobs/123456/?utm_source=x#apply")).toBe(
      "https://boards.greenhouse.io/acme/jobs/123456"
    );
  });
});
