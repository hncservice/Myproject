
"use strict";

require("dotenv").config();

const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const DB_NAME = "hnc_step15q_sandbox";

async function main() {
  const uri = process.env.HNC_SANDBOX_MONGO_URI;

  if (!uri) {
    throw new Error("SANDBOX_URI_MISSING");
  }

  const parsed = new URL(uri);

  assert.ok(
    ["mongodb:", "mongodb+srv:"].includes(parsed.protocol),
    "INVALID_SANDBOX_PROTOCOL"
  );

  assert.equal(
    decodeURIComponent(parsed.pathname),
    `/${DB_NAME}`,
    "INVALID_SANDBOX_DATABASE"
  );

  assert.equal(
    process.env.ALLOCATION_ENABLED,
    "false",
    "PRIZE_ALLOCATION_MUST_BE_DISABLED"
  );

  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "PRODUCTION_ENVIRONMENT_FORBIDDEN"
  );

  console.log("PASS: Local sandbox configuration verified");

  await mongoose.connect(uri, {
    dbName: DB_NAME,
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 1,
  });

  assert.equal(
    mongoose.connection.name,
    DB_NAME,
    "UNEXPECTED_DATABASE_CONNECTION"
  );

  const result = await mongoose.connection.db.command({
    connectionStatus: 1,
    showPrivileges: true,
  });

  const roles =
    result.authInfo?.authenticatedUserRoles || [];

  const privileges =
    result.authInfo?.authenticatedUserPrivileges || [];

  assert.equal(
    roles.length,
    1,
    "EXPECTED_EXACTLY_ONE_ROLE"
  );

  assert.equal(
    roles[0].role,
    "readWrite",
    "UNEXPECTED_MONGODB_ROLE"
  );

  assert.equal(
    roles[0].db,
    DB_NAME,
    "ROLE_DATABASE_MISMATCH"
  );

  assert.ok(
    privileges.length > 0,
    "MISSING_DATABASE_PRIVILEGES"
  );

  for (const privilege of privileges) {
    assert.equal(
      privilege.resource?.db,
      DB_NAME,
      "PRIVILEGE_OUTSIDE_SANDBOX"
    );

    assert.equal(
      typeof privilege.resource?.collection,
      "string",
      "INVALID_PRIVILEGE_RESOURCE"
    );

    assert.notEqual(
      privilege.resource?.anyResource,
      true,
      "GLOBAL_PRIVILEGE_FORBIDDEN"
    );

    assert.notEqual(
      privilege.resource?.cluster,
      true,
      "CLUSTER_PRIVILEGE_FORBIDDEN"
    );
  }

  console.log("PASS: Connected to required sandbox database");
  console.log("PASS: Exactly one readWrite role verified");
  console.log("PASS: All reported privileges restricted to sandbox");
  console.log("PASS: No document reads, writes, or deletes performed");
}

main()
  .catch((error) => {
    console.error(
      "SANDBOX PERMISSION VERIFICATION FAILED:",
      error.message
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log("MongoDB connection closed");
  });
