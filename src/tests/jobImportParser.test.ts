import { describe, expect, it } from "vitest";
import { importedJobDescription, parseNewGradMarkdown } from "../main/jobImportParser";

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
      rawMarkdown: "| raw | row |"
    });

    expect(description).toContain("Imported from speedyapply/2026-SWE-College-Jobs");
    expect(description).toContain("Category: Other");
    expect(description).toContain("| raw | row |");
  });
});
