import {
  ERP_BACKUP_FORMAT,
  createErpBackupFileName,
  createErpBackupJson,
  createErpFirestoreBackup,
  exportErpFirestoreBackup,
  validateErpFirestoreBackup,
} from "./erpBackup";

const timestamp = {
  seconds: 1760000000,
  nanoseconds: 123000000,
  toDate: () => new Date("2025-10-09T08:53:20.123Z"),
};

test("creates a validated ERP backup with stable document IDs and serialized dates", () => {
  const backup = createErpFirestoreBackup({
    collectionNames: ["sites", "expenses"],
    exportedAt: "2026-09-01T08:00:00.000Z",
    appVersion: "test-build",
    collectionDocuments: {
      sites: [{
        id: "site-2",
        data: {
          siteName: "Civil Site",
          createdAt: timestamp,
          reviewDate: new Date("2026-08-30T00:00:00.000Z"),
          nested: { status: "Active" },
        },
      }],
      expenses: [{ id: "expense-1", data: { amount: 1250, site: "Civil Site" } }],
    },
  });

  expect(backup.metadata).toMatchObject({
    format: ERP_BACKUP_FORMAT,
    schemaVersion: 1,
    appVersion: "test-build",
    documentCount: 2,
    collectionNames: ["sites", "expenses"],
  });
  expect(backup.collections.sites[0]).toEqual({
    id: "site-2",
    data: expect.objectContaining({
      createdAt: expect.objectContaining({ __apcBackupType: "timestamp", seconds: 1760000000 }),
      reviewDate: { __apcBackupType: "date", iso: "2026-08-30T00:00:00.000Z" },
    }),
  });
  expect(validateErpFirestoreBackup(backup)).toEqual({ valid: true, documentCount: 2, collectionCount: 2 });
  expect(JSON.parse(createErpBackupJson(backup)).collections.expenses[0].id).toBe("expense-1");
  expect(createErpBackupFileName("2026-09-01T08:00:00.000Z")).toBe("ap-construction-erp-backup-2026-09-01.json");
});

test("redacts prohibited credential-like data rather than placing it in a browser backup", () => {
  const backup = createErpFirestoreBackup({
    collectionNames: ["sites"],
    collectionDocuments: {
      sites: [{
        id: "site-1",
        data: {
          siteName: "Bridge Site",
          password: "never-export",
          nested: { accessToken: "never-export", remarks: "safe" },
        },
      }],
    },
  });

  expect(backup.collections.sites[0].data).toEqual({
    siteName: "Bridge Site",
    nested: { remarks: "safe" },
  });
  expect(backup.metadata.redactedFieldCount).toBe(2);
  expect(createErpBackupJson(backup)).not.toContain("never-export");
});

test("redacts common credential-key aliases at every nesting level", () => {
  const backup = createErpFirestoreBackup({
    collectionNames: ["sites"],
    collectionDocuments: {
      sites: [{
        id: "site-credential-aliases",
        data: {
          siteName: "Bridge Site",
          serviceAccountKey: "never-export-service-account",
          firebase_api_key: "never-export-api-key",
          nested: {
            clientSecret: "never-export-client-secret",
            secretKey: "never-export-secret-key",
            safeValue: "retained",
          },
        },
      }],
    },
  });

  expect(backup.collections.sites[0].data).toEqual({
    siteName: "Bridge Site",
    nested: { safeValue: "retained" },
  });
  expect(backup.metadata.redactedFieldCount).toBe(4);
  expect(createErpBackupJson(backup)).not.toContain("never-export");
});

test("supports empty known collections without pretending data exists", () => {
  const backup = createErpFirestoreBackup({
    collectionNames: ["sites", "invoices"],
    collectionDocuments: { sites: [], invoices: [] },
  });

  expect(backup.metadata.documentCount).toBe(0);
  expect(backup.collections).toEqual({ sites: [], invoices: [] });
});

test("fails safely for duplicate IDs, malformed backups, and unsupported document values", () => {
  expect(() => createErpFirestoreBackup({
    collectionNames: ["sites"],
    collectionDocuments: { sites: [{ id: "site-1", data: {} }, { id: "site-1", data: {} }] },
  })).toThrow(/duplicate document ID/i);

  expect(() => createErpFirestoreBackup({
    collectionNames: ["sites"],
    collectionDocuments: { sites: [{ id: "site-1", data: { amount: Number.NaN } }] },
  })).toThrow(/Non-finite number/i);

  expect(() => createErpFirestoreBackup({
    collectionNames: ["sites", "expenses"],
    collectionDocuments: { sites: [] },
  })).toThrow(/missing the selected expenses collection/i);

  expect(() => validateErpFirestoreBackup({
    metadata: {
      format: ERP_BACKUP_FORMAT,
      schemaVersion: 1,
      application: "AP Construction ERP",
      appVersion: "test",
      scope: "Firestore ERP top-level collection export",
      exportedAt: "invalid",
      collectionNames: ["sites"],
      collectionCount: 1,
      documentCount: 0,
      redactedFieldCount: 0,
    },
    collections: { sites: [] },
  })).toThrow(/application metadata is invalid/i);
});

test("reads each selected collection once and stops without producing a partial backup when a read fails", async () => {
  const loader = jest.fn(async (collectionName) => {
    if (collectionName === "expenses") throw new Error("permission-denied");
    return [{ id: "site-1", data: { siteName: "Civil Site" } }];
  });

  await expect(exportErpFirestoreBackup({
    collectionNames: ["sites", "expenses"],
    loadCollection: loader,
  })).rejects.toMatchObject({ code: "backup-collection-read-failed", collectionName: "expenses" });
  expect(loader).toHaveBeenNthCalledWith(1, "sites");
  expect(loader).toHaveBeenNthCalledWith(2, "expenses");
});

test("accepts Firestore snapshot-like input while retaining document IDs", async () => {
  const backup = await exportErpFirestoreBackup({
    collectionNames: ["dailyProgressReports"],
    loadCollection: async () => ({
      docs: [{ id: "dpr-1", data: () => ({ site: "Civil Site", quantity: 0 }) }],
    }),
  });

  expect(backup.collections.dailyProgressReports).toEqual([{ id: "dpr-1", data: { site: "Civil Site", quantity: 0 } }]);
});