import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { app } from "./app.js";

const server = app.listen(env.API_PORT, () => {
  console.log(`SaaS CMS LMS API listening on http://localhost:${env.API_PORT}`);
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
