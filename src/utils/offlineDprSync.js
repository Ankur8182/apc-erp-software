import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { getAuditFailureMessage, logAuditEvent } from "./auditLogging";

const cleanText = (value) => String(value ?? "").trim();

const createSyncError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const requiresExistingDprCheck = (error) => {
  const code = cleanText(error?.code).toLowerCase();

  return code.includes("permission-denied") || code.includes("already-exists");
};

export const ensureQueuedDprAuthReady = async ({
  userId,
  authInstance = auth,
} = {}) => {
  const owner = cleanText(userId);
  const currentUser = authInstance?.currentUser;

  if (!owner || !currentUser?.uid || cleanText(currentUser.uid) !== owner) {
    throw createSyncError(
      "dpr-outbox-auth-not-ready",
      "The field account is not ready to synchronize this local DPR."
    );
  }

  if (typeof currentUser.getIdToken === "function") {
    try {
      await currentUser.getIdToken();
    } catch (error) {
      throw createSyncError(
        cleanText(error?.code) || "dpr-outbox-auth-not-ready",
        "The field account is not ready to synchronize this local DPR."
      );
    }
  }

  return currentUser;
};

const getConfirmedQueuedDpr = async ({ reportReference, owner, clientSubmissionId }) => {
  try {
    const existingSnapshot = await getDoc(reportReference);

    if (!existingSnapshot.exists()) return null;

    const existing = existingSnapshot.data() || {};
    if (
      cleanText(existing.createdBy) === owner &&
      cleanText(existing.clientSubmissionId) === clientSubmissionId
    ) {
      return { id: reportReference.id, alreadySaved: true, auditWarning: "" };
    }

    throw createSyncError(
      "dpr-outbox-id-collision",
      "A different DPR already uses this submission ID."
    );
  } catch (error) {
    if (cleanText(error?.code) === "dpr-outbox-id-collision") throw error;
    return null;
  }
};

export const createQueuedDprFirestorePayload = (entry = {}) => ({
  ...(entry.payload || {}),
  clientSubmissionId: entry.clientSubmissionId,
  // Phase 8B intentionally stores no image blob or upload metadata in the
  // outbox. A later Storage-specific phase can queue images safely.
  photos: [],
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

export const syncQueuedDprEntry = async ({
  entry,
  userId,
  database = db,
  authInstance = auth,
  auditLogger = logAuditEvent,
} = {}) => {
  const owner = cleanText(userId);
  const entryOwner = cleanText(entry?.userId);
  const payloadOwner = cleanText(entry?.payload?.createdBy);
  const clientSubmissionId = cleanText(entry?.clientSubmissionId);

  if (!owner || owner !== entryOwner || owner !== payloadOwner) {
    throw createSyncError(
      "dpr-outbox-owner-mismatch",
      "The queued DPR does not belong to the active user."
    );
  }
  if (!clientSubmissionId) {
    throw createSyncError(
      "dpr-outbox-invalid-id",
      "The queued DPR has no stable submission ID."
    );
  }

  await ensureQueuedDprAuthReady({ userId: owner, authInstance });

  const reportReference = doc(database, "dailyProgressReports", clientSubmissionId);

  try {
    // A field user can read only an existing DPR they own. Reading a new ID
    // before this create would therefore fail the safe ownership rule and
    // prevent the write. The stable client ID makes this direct create
    // idempotent without granting broader read access.
    await setDoc(reportReference, createQueuedDprFirestorePayload(entry));
  } catch (writeError) {
    if (!requiresExistingDprCheck(writeError)) throw writeError;

    // A write acknowledgement can be lost after the server accepted it. If a
    // retry reaches that already-created own DPR, verify it only after the
    // write fails. The rule permits this read for the owning field user.
    const confirmed = await getConfirmedQueuedDpr({
      reportReference,
      owner,
      clientSubmissionId,
    });

    if (confirmed) return confirmed;
    throw writeError;
  }

  let auditWarning = "";
  try {
    const auditResult = await auditLogger({
      action: "create",
      module: "dailyProgressReports",
      recordId: reportReference.id,
      recordLabel: entry.payload.workActivity,
      details: "Field Daily Progress Report synchronized from this device.",
      site: entry.payload.site,
    });
    if (!auditResult?.success) auditWarning = getAuditFailureMessage();
  } catch (error) {
    auditWarning = getAuditFailureMessage();
  }

  return {
    id: reportReference.id,
    alreadySaved: false,
    auditWarning,
  };
};
