import { describe, expect, it } from "vitest";
import {
  getAcademicReportCatalog,
  listSubjectGroups,
} from "../src/modules/academics/academics-extensions.service.js";

describe("academics extensions helpers", () => {
  it("returns academic report catalog entries", async () => {
    const catalog = await getAcademicReportCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(8);
    expect(catalog.some((item) => item.key === "scholars")).toBe(true);
    expect(catalog.some((item) => item.key === "teacher_workload")).toBe(true);
  });

  it("lists subject groups for an unknown tenant as empty", async () => {
    const rows = await listSubjectGroups("tenant_that_does_not_exist");
    expect(rows).toEqual([]);
  });
});
