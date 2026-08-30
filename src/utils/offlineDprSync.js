import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { getAuditFailureMessage, logAuditEvent } from "./auditLogging";

const cleanText = (value) => String(value ?? "").trim();

const createSyncError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
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

  const reportReference = doc(database, "dailyProgressReports", clientSubmissionId);
  const existingSnapshot = await getDoc(reportReference);

  if (existingSnapshot.exists()) {
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
  }

  await setDoc(reportReference, createQueuedDprFirestorePayload(entry));

  const auditResult = await auditLogger({
    action: "create",
    module: "dailyProgressReports",
    recordId: reportReference.id,
    recordLabel: entry.payload.workActivity,
    details: "Field Daily Progress Report synchronized from this device.",
    site: entry.payload.site,
  });

  return {
    id: reportReference.id,
    alreadySaved: false,
    auditWarning: auditResult?.success ? "" : getAuditFailureMessage(),
  };
};