import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const integration = describe.runIf(process.env.RUN_INTEGRATION_TESTS === "true");

integration("Phase 3 tenant API", () => {
  let server: Server;
  let baseUrl: string;
  let adminToken: string;
  let teacherToken: string;

  async function login(email: string) {
    const password =
      email === "admin@demo-school.local" ? "11111111" : "ChangeMe123!";
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantSlug: "demo-school",
        email,
        password,
      }),
    });
    const body = await response.json() as { data: { accessToken: string } };
    expect(response.status).toBe(200);
    return body.data.accessToken;
  }

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Test server did not start");
        baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
        resolve();
      });
    });
    [adminToken, teacherToken] = await Promise.all([
      login("admin@demo-school.local"),
      login("teacher@demo-school.local"),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function get(path: string, token = adminToken) {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as { data: unknown; error?: { code: string } };
    return { response, body };
  }

  it.each([
    ["/exams/setup", "groups"],
    ["/hr/setup", "staff"],
    ["/documents/templates", "array"],
    ["/reports", "modules"],
  ])("returns Phase 3 tenant data from %s", async (path, property) => {
    const { response, body } = await get(path);
    expect(response.status).toBe(200);
    if (property === "array") {
      expect(Array.isArray(body.data)).toBe(true);
      expect((body.data as unknown[]).length).toBeGreaterThan(0);
    } else {
      expect(body.data).toHaveProperty(property);
    }
  });

  it("calculates the seeded exam result and rank", async () => {
    const setup = await get("/exams/setup");
    const group = (setup.body.data as {
      groups: Array<{ id: string; exams: Array<{ id: string; name: string }> }>;
    }).groups.find((item) => item.exams.some((exam) => exam.name === "Mid Term"));
    const exam = group?.exams.find((item) => item.name === "Mid Term");
    expect(exam).toBeTruthy();

    const result = await get(`/exams/${exam!.id}/results`);
    expect(result.response.status).toBe(200);
    const rows = (result.body.data as {
      results: Array<{ rank: number; obtainedMarks: number; passStatus: string }>;
    }).results;
    expect(rows[0]).toMatchObject({ rank: 1, obtainedMarks: 86, passStatus: "PASS" });

    const consolidated = await get(`/exams/groups/${group!.id}/results`);
    expect(consolidated.response.status).toBe(200);
    expect((consolidated.body.data as {
      results: Array<{ rank: number; obtainedMarks: number }>;
    }).results[0]).toMatchObject({ rank: 1, obtainedMarks: 86 });
  });

  it("keeps payroll and reports permission-protected", async () => {
    const response = await fetch(`${baseUrl}/hr/payroll`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${teacherToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        academicSessionId: "not-used",
        payrollMonth: "2026-07-01",
      }),
    });
    const body = await response.json() as { error: { code: string } };
    expect(response.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });
});
