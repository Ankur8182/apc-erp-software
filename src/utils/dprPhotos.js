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

const normaliseText = (value) => String(value ?? "").trim();
const safeSegment = (value, fallback) =>
  normaliseText(value).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120) || fallback;

const getPhotoExtension = (contentType) => ({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}[normaliseText(contentType).toLowerCase()] || "jpg");

const getTimestamp = (value, defaultToNow = false) => {
  const rawDate = value?.toDate instanceof Function ? value.toDate() : value;
  const parsed = rawDate ? new Date(rawDate) : (defaultToNow ? new Date() : null);
  return !parsed || Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};

const getRandomPhotoSegment = () => {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return window.crypto.randomUUID().replace(/-/g, "");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
};

export const sanitiseDprPhotoName = (fileName) => {
  const cleanedName = normaliseText(fileName)
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-");

  return cleanedName || "site-photo";
};

export const createDprPhotoId = () => `photo-${getRandomPhotoSegment()}`.slice(0, 110);

export const validateDprPhotoFiles = (files, existingCount = 0) => {
  const selectedFiles = Array.from(files || []);
  const currentCount = Math.max(Number(existingCount) || 0, 0);

  if (currentCount + selectedFiles.length > MAX_DPR_PHOTO_COUNT) {
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

export const isDprPhotoStoragePath = (value) => {
  const storagePath = normaliseText(value);
  return storagePath.startsWith("dprPhotos/") || storagePath.startsWith("dpr/");
};

export const createDprPhotoStoragePath = (
  userId,
  dprId,
  photoId = createDprPhotoId(),
  file
) => {
  const owner = safeSegment(userId, "unknown-user");
  const reportId = safeSegment(dprId, "unknown-dpr");
  const stablePhotoId = safeSegment(photoId, createDprPhotoId());
  const extension = getPhotoExtension(file?.type || file);

  return `dprPhotos/${owner}/${reportId}/${stablePhotoId}.${extension}`;
};

export const createDprPhotoMetadata = ({
  file,
  storagePath,
  url,
  photoId = "",
  uploadedBy = "",
  uploadedAt,
} = {}) => {
  const cleanStoragePath = normaliseText(storagePath);
  const pathPhotoId = cleanStoragePath.split("/").pop()?.split(".")[0];

  return {
    id: safeSegment(photoId, safeSegment(pathPhotoId, "photo")),
    name: sanitiseDprPhotoName(file?.name),
    storagePath: cleanStoragePath,
    contentType: normaliseText(file?.type),
    size: Math.max(Number(file?.size) || 0, 0),
    url: normaliseText(url),
    uploadedBy: normaliseText(uploadedBy),
    uploadedAt: getTimestamp(uploadedAt, true),
  };
};

const normaliseDprPhotoMetadata = (photo) => {
  if (!photo || typeof photo !== "object") return null;
  const storagePath = normaliseText(photo.storagePath);
  const url = normaliseText(photo.url);

  if (!isDprPhotoStoragePath(storagePath) || !url.startsWith("https://")) return null;

  return {
    id: safeSegment(photo.id, safeSegment(storagePath.split("/").pop()?.split(".")[0], "photo")),
    name: sanitiseDprPhotoName(photo.name),
    storagePath,
    contentType: normaliseText(photo.contentType),
    size: Math.max(Number(photo.size) || 0, 0),
    url,
    uploadedBy: normaliseText(photo.uploadedBy),
    uploadedAt: getTimestamp(photo.uploadedAt),
  };
};

export const getDprPhotoMetadata = (report = {}) => (
  Array.isArray(report.photos) ? report.photos : []
).map(normaliseDprPhotoMetadata).filter(Boolean);

export const isDprPhotoStorageUnavailable = (error) => {
  const code = normaliseText(error?.code).toLowerCase();
  const message = normaliseText(error?.message).toLowerCase();

  return STORAGE_UNAVAILABLE_CODES.has(code) ||
    message.includes("storage has not been enabled") ||
    message.includes("firebase storage has not been set up") ||
    message.includes("storage bucket does not exist");
};

export const getDprPhotoUploadFallbackMessage = (error) => (
  isDprPhotoStorageUnavailable(error)
    ? "Photo upload is currently unavailable. The site update will be saved without photos."
    : "Photo upload could not be completed. The site update will be saved without photos."
);