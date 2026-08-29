const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { getApps, initializeApp } = require("firebase-admin/app");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

if (!getApps().length) initializeApp();

const db = getFirestore();
const auth = getAuth();
const ERP_USER_ROLES = ["admin", "manager", "viewer", "supervisor", "engineer"];
const MAX_USERS_PER_RESPONSE = 500;

const cleanText = (value, maxLength = 0) => {
  const text = String(value || "").trim();
  return maxLength ? text.slice(0, maxLength) : text;
};

const toMillis = (value) => {
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getActiveAdmin = async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const profileSnapshot = await db.collection("users").doc(request.auth.uid).get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() : null;

  if (!profile || profile.active !== true || profile.role !== "admin") {
    throw new HttpsError("permission-denied", "Administrator access is required.");
  }

  return {
    uid: request.auth.uid,
    email: cleanText(request.auth.token?.email, 320),
  };
};

const getSafeUserProfile = async (profileDocument) => {
  const profile = profileDocument.data() || {};
  const uid = profileDocument.id;
  let authUser = null;

  try {
    authUser = await auth.getUser(uid);
  } catch (error) {
    logger.warn("ERP profile has no matching Firebase Auth user", { uid, code: error.code });
  }

  return {
    uid,
    name: cleanText(profile.name || profile.displayName || authUser?.displayName, 200),
    email: cleanText(profile.email || authUser?.email, 320),
    role: cleanText(profile.role).toLowerCase(),
    active: profile.active === true,
    createdAt: toMillis(profile.createdAt) || toMillis(authUser?.metadata?.creationTime),
    updatedAt: toMillis(profile.updatedAt),
  };
};

exports.listErpUsers = onCall(async (request) => {
  await getActiveAdmin(request);

  const profilesSnapshot = await db.collection("users").get();

  if (profilesSnapshot.size > MAX_USERS_PER_RESPONSE) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many ERP users to load in one request."
    );
  }

  const users = await Promise.all(
    profilesSnapshot.docs
      .filter((profileDocument) =>
        ERP_USER_ROLES.includes(cleanText(profileDocument.data()?.role).toLowerCase())
      )
      .map(getSafeUserProfile)
  );

  return { users };
});

exports.updateErpUser = onCall(async (request) => {
  const adminUser = await getActiveAdmin(request);
  const data = request.data || {};
  const allowedKeys = ["userId", "role", "active"];

  if (Object.keys(data).some((key) => !allowedKeys.includes(key))) {
    throw new HttpsError("invalid-argument", "Unsupported user update data.");
  }

  const userId = cleanText(data.userId, 128);
  const role = cleanText(data.role).toLowerCase();
  const active = data.active;

  if (!userId || !ERP_USER_ROLES.includes(role) || typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "A valid user, role, and status are required.");
  }

  if (userId === adminUser.uid) {
    throw new HttpsError(
      "failed-precondition",
      "Administrators cannot change their own role or active status."
    );
  }

  const profileReference = db.collection("users").doc(userId);
  const profileSnapshot = await profileReference.get();

  if (!profileSnapshot.exists) {
    throw new HttpsError("not-found", "The ERP user profile was not found.");
  }

  try {
    await auth.getUser(userId);
  } catch (error) {
    logger.warn("Role management target has no Firebase Auth user", { userId, code: error.code });
    throw new HttpsError("failed-precondition", "The linked Firebase Authentication user was not found.");
  }

  const currentProfile = profileSnapshot.data() || {};
  const recordLabel = cleanText(
    currentProfile.name || currentProfile.displayName || currentProfile.email || userId,
    250
  );
  const auditReference = db.collection("auditLogs").doc();
  const batch = db.batch();

  batch.update(profileReference, {
    role,
    active,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: adminUser.uid,
  });
  batch.set(auditReference, {
    userId: adminUser.uid,
    userEmail: adminUser.email,
    userRole: "admin",
    action: "update",
    module: "users",
    recordId: userId,
    recordLabel,
    timestamp: FieldValue.serverTimestamp(),
    details: `ERP user role/status updated to ${role}/${active ? "active" : "inactive"}.`,
    site: "",
  });

  await batch.commit();

  return {
    user: {
      uid: userId,
      name: cleanText(currentProfile.name || currentProfile.displayName, 200),
      email: cleanText(currentProfile.email, 320),
      role,
      active,
      createdAt: toMillis(currentProfile.createdAt),
      updatedAt: Date.now(),
    },
  };
});
