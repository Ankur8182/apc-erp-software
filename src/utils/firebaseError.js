const normaliseText = (value) => String(value || "").trim().toLowerCase();

export const getUserFriendlyFirebaseError = (error, fallbackMessage) => {
  const code = normaliseText(error?.code);
  const message = normaliseText(error?.message);

  if (code.includes("permission-denied") || code.includes("unauthorized")) {
    return "You do not have permission to complete this action. Contact an administrator.";
  }

  if (
    code.includes("unavailable") ||
    code.includes("network") ||
    message.includes("network") ||
    message.includes("offline")
  ) {
    return "Unable to connect right now. Check your internet connection and try again.";
  }

  return fallbackMessage;
};
