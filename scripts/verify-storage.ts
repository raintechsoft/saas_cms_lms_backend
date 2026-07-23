import { getStorageDriver, verifyStorageConnection } from "../src/lib/uploads.js";

async function main() {
  const result = await verifyStorageConnection();
  if (!result.ok) {
    console.error(`Storage verify failed (driver=${result.driver}): ${result.reason}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Storage OK — driver=${result.driver}`);
  console.log(`Detail: ${result.detail}`);
  if (getStorageDriver() === "local") {
    console.log("Tip: set STORAGE_DRIVER=s3 plus S3_* vars for production cloud uploads.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
