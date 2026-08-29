import {
  createDprPhotoMetadata,
  createDprPhotoStoragePath,
  getDprPhotoUploadFallbackMessage,
  getDprPhotoMetadata,
  sanitiseDprPhotoName,
  validateDprPhotoFiles,
} from "./dprPhotos";

test("validates safe DPR photo files and rejects invalid uploads", () => {
  const validPhoto = {
    name: "site progress.png",
    type: "image/png",
    size: 1024,
  };

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
});

test("creates Storage-only photo metadata without embedding file data", () => {
  const file = {
    name: "work photo (1).jpg",
    type: "image/jpeg",
    size: 1234,
    base64: "must-not-be-stored",
  };
  const storagePath = createDprPhotoStoragePath("user-1", "dpr-1", 0, file.name);
  const metadata = createDprPhotoMetadata({
    file,
    storagePath,
    url: "https://firebasestorage.googleapis.com/photo",
  });

  expect(sanitiseDprPhotoName(file.name)).toBe("work-photo-1-.jpg");
  expect(storagePath).toBe("dpr/user-1/dpr-1/1-work-photo-1-.jpg");
  expect(metadata).toEqual({
    name: "work-photo-1-.jpg",
    storagePath,
    contentType: "image/jpeg",
    size: 1234,
    url: "https://firebasestorage.googleapis.com/photo",
  });
  expect(metadata).not.toHaveProperty("base64");
  expect(metadata).not.toHaveProperty("file");
});

test("keeps legacy DPRs without photos compatible", () => {
  expect(getDprPhotoMetadata({ id: "legacy" })).toEqual([]);
  expect(
    getDprPhotoMetadata({
      photos: [
        {
          storagePath: "dpr/user-1/dpr-1/1-photo.jpg",
          url: "https://firebasestorage.googleapis.com/photo",
        },
        { storagePath: "other/path", url: "https://example.com/photo" },
      ],
    })
  ).toHaveLength(1);
});

test("allows a DPR to continue safely when Firebase Storage is unavailable", () => {
  expect(
    getDprPhotoUploadFallbackMessage({
      code: "storage/no-default-bucket",
      message: "Firebase Storage has not been set up",
    })
  ).toBe(
    "Photo upload is currently unavailable. The site update will be saved without photos."
  );

  expect(
    getDprPhotoUploadFallbackMessage({ code: "storage/unknown" })
  ).toBe(
    "Photo upload could not be completed. The site update will be saved without photos."
  );
});
