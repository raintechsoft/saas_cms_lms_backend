import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const integration = describe.runIf(process.env.RUN_INTEGRATION_TESTS === "true");

integration("Phase 1 tenant API", () => {
  let server: Server;
  let baseUrl: string;
  let token: string;

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
        password: "ChangeMe123!",
      }),
    });
    const body = await response.json() as { data: { accessToken: string } };
    expect(response.status).toBe(200);
    token = body.data.accessToken;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it.each([
    ["/settings", "currency"],
    ["/academics/setup", "classes"],
    ["/students/setup", "classSections"],
    ["/users", "0"],
    ["/roles", "0"],
  ])("returns tenant-scoped data from %s", async (path, expectedKey) => {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as { data: unknown };
    expect(response.status).toBe(200);
    if (Array.isArray(body.data)) {
      expect(body.data.length).toBeGreaterThan(0);
    } else {
      expect(body.data).toHaveProperty(expectedKey);
    }
  });

  it("rejects non-teacher users as class teachers", async () => {
    const setupResponse = await fetch(`${baseUrl}/academics/setup`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const setup = await setupResponse.json() as {
      data: {
        currentSession: { id: string };
        classes: Array<{ id: string }>;
        sections: Array<{ id: string }>;
      };
    };
    const usersResponse = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const users = await usersResponse.json() as {
      data: Array<{ id: string; roles: Array<{ role: { code: string } }> }>;
    };
    const admin = users.data.find((user) =>
      user.roles.some(({ role }) => role.code === "INSTITUTION_ADMIN"),
    );
    expect(admin).toBeTruthy();

    const response = await fetch(`${baseUrl}/academics/class-sections`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        academicSessionId: setup.data.currentSession.id,
        classId: setup.data.classes[0].id,
        sectionId: setup.data.sections[0].id,
        classTeacherId: admin!.id,
      }),
    });
    const body = await response.json() as { error: { code: string } };
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_TEACHER");
  });
});
