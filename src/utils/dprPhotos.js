export const MAX_DPR_PHOTO_COUNT = 5;
export const MAX_DPR_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_DPR_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const STORAGE_UNAVAILABLE_CODES = new Set([
  "storage/bucket-not-found",
  "storage/no-default-bucket",
  "storage/project-not-found",
]);

const normaliseText = (value) => String(value || "").trim();

export const sanitiseDprPhotoName = (fileName) => {
  const cleanedName = normaliseText(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return cleanedName || "site-photo";
};

export const validateDprPhotoFiles = (files, existingCount = 0) => {
  const selectedFiles = Array.from(files || []);

  if (existingCount + selectedFiles.length > MAX_DPR_PHOTO_COUNT) {
    return {
      isValid: false,
      error: `A DPR can have up to ${MAX_DPR_PHOTO_COUNT} photos.`,
    };
  }

  const invalidFile = selectedFiles.find(
    (file) =>
      !ALLOWED_DPR_PHOTO_TYPES.has(file?.type) ||
      !Number.isFinite(file?.size) ||
      file.size <= 0 ||
      file.size > MAX_DPR_PHOTO_SIZE_BYTES
  );

  if (invalidFile) {
    return {
      isValid: false,
      error: "Photos must be JPG, PNG, or WebP files up to 5 MB each.",
    };
  }

  return { isValid: true, files: selectedFiles };
};

export const createDprPhotoStoragePath = (userId, dprId, index, fileName) =>
  `dpr/${normaliseText(userId)}/${normaliseText(dprId)}/${index + 1}-${sanitiseDprPhotoName(fileName)}`;

export const createDprPhotoMetadata = ({ file, storagePath, url }) => ({
  name: sanitiseDprPhotoName(file?.name),
  storagePath: normaliseText(storagePath),
  contentType: normaliseText(file?.type),
  size: Number(file?.size) || 0,
  url: normaliseText(url),
});

export const getDprPhotoMetadata = (report = {}) =>
  Array.isArray(report.photos)
    ? report.photos.filter(
        (photo) =>
          photo &&
          typeof photo === "object" &&
          normaliseText(photo.storagePath).startsWith("dpr/") &&
          normaliseText(photo.url).startsWith("https://")
      )
    : [];

export const getDprPhotoUploadFallbackMessage = (error) => {
  const code = normaliseText(error?.code).toLowerCase();
  const message = normaliseText(error?.message).toLowerCase();
  const storageUnavailable =
    STORAGE_UNAVAILABLE_CODES.has(code) ||
    message.includes("storage has not been enabled") ||
    message.includes("firebase storage has not been set up") ||
    message.includes("storage bucket does not exist");

  return storageUnavailable
    ? "Photo upload is currently unavailable. The site update will be saved without photos."
    : "Photo upload could not be completed. The site update will be saved without photos.";
};
