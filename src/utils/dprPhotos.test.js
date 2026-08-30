import {
  MAX_DPR_PHOTO_COUNT,
  createDprPhotoId,
  createDprPhotoMetadata,
  createDprPhotoStoragePath,
  getDprPhotoUploadFallbackMessage,
  getDprPhotoMetadata,
  isDprPhotoStorageUnavailable,
  sanitiseDprPhotoName,
  validateDprPhotoFiles,
} from "./dprPhotos";

const validPhoto = {
  name: "site progress.png",
  type: "image/png",
  size: 1024,
};

test("validates safe DPR photo files, existing limits, and rejects invalid uploads", () => {
  expect(validateDprPhotoFiles([validPhoto])).toMatchObject({
    isValid: true,
    files: [validPhoto],
  });
  expect(
    validateDprPhotoFiles([{ name: "report.pdf", type: "application/pdf", size: 1024 }])
  ).toMatchObject({ isValid: false });
  expect(
    validateDprPhotoFiles([{ name: "large.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 }])
  ).toMatchObject({ isValid: false });
  expect(
    validateDprPhotoFiles([validPhoto], MAX_DPR_PHOTO_COUNT)
  ).toMatchObject({ isValid: false, error: expect.stringMatching(/up to 5 photos/i) });
});

test("creates stable owner-isolated paths without using an untrusted file name", () => {
  const file = {
    name: "work photo (1).jpg",
    type: "image/jpeg",
    size: 1234,
    base64: "must-not-be-stored",
  };
  const photoId = "photo-safeEvidence01";
  const storagePath = createDprPhotoStoragePath("user-1", "dpr-1", photoId, file);
  const metadata = createDprPhotoMetadata({
    file,
    storagePath,
    url: "https://firebasestorage.googleapis.com/photo",
    photoId,
    uploadedBy: "user-1",
    uploadedAt: "2026-09-05T10:00:00.000Z",
  });

  expect(createDprPhotoId()).toMatch(/^photo-[A-Za-z0-9_-]+$/);
  expect(sanitiseDprPhotoName(file.name)).toBe("work-photo-1-.jpg");
  expect(storagePath).toBe("dprPhotos/user-1/dpr-1/photo-safeEvidence01.jpg");
  expect(storagePath).not.toContain("work-photo");
  expect(metadata).toEqual({
    id: photoId,
    name: "work-photo-1-.jpg",
    storagePath,
    contentType: "image/jpeg",
    size: 1234,
    url: "https://firebasestorage.googleapis.com/photo",
    uploadedBy: "user-1",
    uploadedAt: "2026-09-05T10:00:00.000Z",
  });
  expect(metadata).not.toHaveProperty("base64");
  expect(metadata).not.toHaveProperty("file");
});

test("normalizes supported evidence metadata and keeps malformed or legacy DPRs safe", () => {
  expect(getDprPhotoMetadata({ id: "legacy" })).toEqual([]);
  expect(
    getDprPhotoMetadata({
      photos: [
        {
          storagePath: "dpr/user-1/dpr-1/1-photo.jpg",
          url: "https://firebasestorage.googleapis.com/photo",
        },
        {
          id: "photo-new-01",
          storagePath: "dprPhotos/user-1/dpr-1/photo-new-01.webp",
          url: "https://firebasestorage.googleapis.com/new-photo",
          uploadedBy: "user-1",
          uploadedAt: "2026-09-05T10:00:00.000Z",
        },
        { storagePath: "other/path", url: "https://example.com/photo" },
        null,
      ],
    })
  ).toEqual([
    expect.objectContaining({
      storagePath: "dpr/user-1/dpr-1/1-photo.jpg",
      uploadedAt: "",
    }),
    expect.objectContaining({
      id: "photo-new-01",
      storagePath: "dprPhotos/user-1/dpr-1/photo-new-01.webp",
      uploadedBy: "user-1",
    }),
  ]);
});

test("identifies Storage-unavailable fallback without treating other errors as unavailable", () => {
  const unavailable = {
    code: "storage/no-default-bucket",
    message: "Firebase Storage has not been set up",
  };

  expect(isDprPhotoStorageUnavailable(unavailable)).toBe(true);
  expect(isDprPhotoStorageUnavailable({ code: "storage/unknown" })).toBe(false);
  expect(getDprPhotoUploadFallbackMessage(unavailable)).toBe(
    "Photo upload is currently unavailable. The site update will be saved without photos."
  );
  expect(getDprPhotoUploadFallbackMessage({ code: "storage/unknown" })).toBe(
    "Photo upload could not be completed. The site update will be saved without photos."
  );
});