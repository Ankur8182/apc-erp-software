import { collection, getDocs, limit, orderBy, query, startAfter } from "firebase/firestore";

export const AUDIT_LOG_PAGE_SIZE = 100;

export const mapAuditLogSnapshot = (snapshot, pageSize = AUDIT_LOG_PAGE_SIZE) => {
  const documents = Array.isArray(snapshot?.docs) ? snapshot.docs : [];

  return {
    logs: documents.map((entry) => ({
      id: entry.id,
      ...(typeof entry.data === "function" ? entry.data() || {} : {}),
    })),
    cursor: documents[documents.length - 1] || null,
    hasMore: documents.length === pageSize,
  };
};

export const mergeAuditLogPages = (currentLogs, nextLogs) => {
  const recordsById = new Map();
  const records = [
    ...(Array.isArray(currentLogs) ? currentLogs : []),
    ...(Array.isArray(nextLogs) ? nextLogs : []),
  ];

  records.forEach((record) => {
    if (record?.id) recordsById.set(record.id, record);
  });

  return Array.from(recordsById.values());
};

export const getAuditLogPage = async ({
  database,
  cursor = null,
  pageSize = AUDIT_LOG_PAGE_SIZE,
} = {}) => {
  const constraints = [orderBy("timestamp", "desc")];

  if (cursor) constraints.push(startAfter(cursor));

  constraints.push(limit(pageSize));

  const snapshot = await getDocs(query(collection(database, "auditLogs"), ...constraints));

  return mapAuditLogSnapshot(snapshot, pageSize);
};
