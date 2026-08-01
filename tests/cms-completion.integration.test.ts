import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const integration = describe.runIf(process.env.RUN_INTEGRATION_TESTS === "true");

integration("CMS completion tenant API", () => {
  let server: Server;
  let baseUrl: string;
  let adminToken: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const address = server.address();
        if (!address || typeof address === "string") throw new Error("Test server did not start");
        baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
        resolve();
      });
    });
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantSlug: "demo-school",
        email: "admin@demo-school.local",
        password: "11111111",
      }),
    });
    const body = await response.json() as { data: { accessToken: string } };
    expect(response.status).toBe(200);
    adminToken = body.data.accessToken;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  async function request(path: string, init?: RequestInit) {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    return {
      response,
      body: await response.json() as {
        data: unknown;
        error?: { code: string };
      },
    };
  }

  it("returns timetable, homework, and ERP tenant setup", async () => {
    const [timetable, homework, erp] = await Promise.all([
      request("/timetable/setup"),
      request("/homework/setup"),
      request("/erp/setup"),
    ]);
    expect(timetable.response.status).toBe(200);
    expect(homework.response.status).toBe(200);
    expect(erp.response.status).toBe(200);
    expect((timetable.body.data as { entries: unknown[] }).entries.length).toBeGreaterThan(0);
    expect((homework.body.data as { homework: unknown[] }).homework.length).toBeGreaterThan(0);
    expect((erp.body.data as { modules: unknown[] }).modules.length).toBeGreaterThan(0);
  });

  it("rejects overlapping class and teacher timetable periods", async () => {
    const setup = (await request("/timetable/setup")).body.data as {
      currentSession: { id: string };
      entries: Array<{
        classSection: { id: string };
        classSubject: { id: string };
        teacher: { id: string };
        weekday: string;
      }>;
    };
    const seeded = setup.entries[0];
    const { response, body } = await request("/timetable/entries", {
      method: "POST",
      body: JSON.stringify({
        academicSessionId: setup.currentSession.id,
        classSectionId: seeded.classSection.id,
        classSubjectId: seeded.classSubject.id,
        teacherId: seeded.teacher.id,
        weekday: seeded.weekday,
        startTime: "09:30",
        endTime: "10:30",
      }),
    });
    expect(response.status).toBe(409);
    expect(body.error?.code).toBe("CLASS_TIMETABLE_CONFLICT");
  });

  it("provides homework completion and due metrics", async () => {
    const setup = (await request("/homework/setup")).body.data as {
      currentSession: { id: string };
    };
    const report = await request(`/homework-reports?sessionId=${setup.currentSession.id}`);
    expect(report.response.status).toBe(200);
    const rows = report.body.data as Array<{
      assigned: number;
      submitted: number;
      due: number;
      progressPercent: number;
    }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].assigned).toBeGreaterThanOrEqual(rows[0].submitted);
    expect(rows[0].due).toBeGreaterThanOrEqual(0);
    expect(rows[0].progressPercent).toBeGreaterThanOrEqual(0);
  });

  it("creates a tenant-scoped configuration backup", async () => {
    const result = await request("/erp/backups", {
      method: "POST",
      body: JSON.stringify({ name: `Integration ${Date.now()}` }),
    });
    expect(result.response.status).toBe(201);
    expect(result.body.data).toHaveProperty("id");
  });
});
