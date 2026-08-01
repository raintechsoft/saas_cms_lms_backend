import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const integration = describe.runIf(process.env.RUN_INTEGRATION_TESTS === "true");

async function login(baseUrl: string, email: string) {
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

integration("Phase 2 fees and attendance API", () => {
  let server: Server;
  let baseUrl: string;
  let adminToken: string;
  let teacherToken: string;

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
      login(baseUrl, "admin@demo-school.local"),
      login(baseUrl, "teacher@demo-school.local"),
    ]);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it("returns fee setup, student dues, and summary", async () => {
    const setupResponse = await fetch(`${baseUrl}/fees/setup`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const setup = await setupResponse.json() as {
      data: {
        currentSession: { id: string };
        types: unknown[];
        groups: unknown[];
        masters: unknown[];
        classSections: Array<{
          id: string;
          enrollments: Array<{ id: string; student: { id: string } }>;
        }>;
      };
    };
    expect(setupResponse.status).toBe(200);
    expect(setup.data.types.length).toBeGreaterThan(0);
    expect(setup.data.groups.length).toBeGreaterThan(0);
    expect(setup.data.masters.length).toBeGreaterThan(0);

    const enrolledSection = setup.data.classSections.find(
      ({ enrollments }) => enrollments.length > 0,
    );
    expect(enrolledSection).toBeTruthy();
    const studentId = enrolledSection!.enrollments[0].student.id;
    const duesResponse = await fetch(`${baseUrl}/fees/students/${studentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dues = await duesResponse.json() as {
      data: { assignments: unknown[]; totals: { balance: number } };
    };
    expect(duesResponse.status).toBe(200);
    expect(dues.data.assignments.length).toBeGreaterThan(0);
    expect(dues.data.totals.balance).toBeGreaterThanOrEqual(0);

    const summaryResponse = await fetch(
      `${baseUrl}/fees/reports/summary?sessionId=${setup.data.currentSession.id}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    expect(summaryResponse.status).toBe(200);
  });

  it("collects a partial payment, generates a receipt, and reverts it", async () => {
    const setupResponse = await fetch(`${baseUrl}/fees/setup`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const setup = await setupResponse.json() as {
      data: {
        currentSession: { id: string };
        classSections: Array<{
          enrollments: Array<{ student: { id: string } }>;
        }>;
      };
    };
    const enrolledSection = setup.data.classSections.find(
      ({ enrollments }) => enrollments.length > 0,
    );
    expect(enrolledSection).toBeTruthy();
    const studentId = enrolledSection!.enrollments[0].student.id;
    const duesResponse = await fetch(`${baseUrl}/fees/students/${studentId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const dues = await duesResponse.json() as {
      data: {
        assignments: Array<{ id: string; totals: { balance: number } }>;
      };
    };
    const assignment = dues.data.assignments.find(({ totals }) => totals.balance > 0);
    expect(assignment).toBeTruthy();

    const paymentResponse = await fetch(`${baseUrl}/fees/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId,
        academicSessionId: setup.data.currentSession.id,
        paymentDate: "2026-07-17",
        paymentMode: "CASH",
        items: [{ assignmentId: assignment!.id, amount: 1 }],
      }),
    });
    const payment = await paymentResponse.json() as {
      data: { id: string; receiptNumber: string; paymentId: string };
    };
    expect(paymentResponse.status).toBe(201);
    expect(payment.data.receiptNumber).toBeTruthy();
    expect(payment.data.paymentId).toBeTruthy();

    const revertResponse = await fetch(
      `${baseUrl}/fees/payments/${payment.data.id}/revert`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "Automated integration test reversal" }),
      },
    );
    const reverted = await revertResponse.json() as { data: { status: string } };
    expect(revertResponse.status).toBe(200);
    expect(reverted.data.status).toBe("REVERTED");
  });

  it("marks attendance idempotently and returns a report", async () => {
    const setupResponse = await fetch(`${baseUrl}/fees/setup`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const initial = await setupResponse.json() as {
      data: { classSections: Array<{ id: string; enrollments: unknown[] }> };
    };
    const classSectionId = initial.data.classSections.find(
      ({ enrollments }) => enrollments.length > 0,
    )?.id;
    expect(classSectionId).toBeTruthy();
    const rosterResponse = await fetch(
      `${baseUrl}/attendance/setup?date=2026-07-17&classSectionId=${classSectionId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const roster = await rosterResponse.json() as {
      data: { roster: Array<{ id: string }> };
    };
    expect(roster.data.roster.length).toBeGreaterThan(0);

    const markResponse = await fetch(`${baseUrl}/attendance/records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        classSectionId,
        attendanceDate: "2026-07-17",
        records: roster.data.roster.map(({ id }) => ({
          studentEnrollmentId: id,
          status: "PRESENT",
          inTime: "08:00",
        })),
      }),
    });
    expect(markResponse.status).toBe(200);

    const reportResponse = await fetch(
      `${baseUrl}/attendance/reports?fromDate=2026-07-17&toDate=2026-07-17&classSectionId=${classSectionId}`,
      { headers: { Authorization: `Bearer ${adminToken}` } },
    );
    const report = await reportResponse.json() as {
      data: { records: unknown[]; summaries: unknown[] };
    };
    expect(reportResponse.status).toBe(200);
    expect(report.data.records.length).toBeGreaterThan(0);
    expect(report.data.summaries.length).toBeGreaterThan(0);
  });

  it("allows teachers to mark attendance but not access fees", async () => {
    const attendanceResponse = await fetch(`${baseUrl}/attendance/setup?date=2026-07-17`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const feesResponse = await fetch(`${baseUrl}/fees/setup`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(attendanceResponse.status).toBe(200);
    expect(feesResponse.status).toBe(403);
  });
});
