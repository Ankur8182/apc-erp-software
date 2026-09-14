const fs = require("fs");
const path = require("path");

const storageRules = fs.readFileSync(
  path.join(process.cwd(), "storage.rules"),
  "utf8"
);

describe("Storage photo security rules", () => {
  test("keeps DPR photos authenticated, owner-scoped, typed, and size-bounded", () => {
    expect(storageRules).toContain("match /dprPhotos/{userId}/{dprId}/{photoFile} {");
    expect(storageRules).toContain("request.auth.uid == userId");
    expect(storageRules).toContain("request.resource.size <= 5 * 1024 * 1024");
    expect(storageRules).toContain("request.resource.contentType.matches('image/(jpeg|png|webp)')");
    expect(storageRules).toContain("hasValidStablePhotoName(photoFile)");
    expect(storageRules).toContain("allow delete: if isAdminOrManager();");
    expect(storageRules).not.toContain(
      "allow delete: if isAdminOrManager() ||\n        (isFieldUser() && request.auth.uid == userId);"
    );
  });

  test("keeps legacy evidence read-compatible and all other paths default-denied", () => {
    expect(storageRules).toContain("match /dpr/{userId}/{dprId}/{fileName} {");
    expect(storageRules).toContain("allow create, update: if false;");
    const adminOnlyDeleteRules = storageRules.match(/allow delete: if isAdminOrManager\(\);/g) || [];
    expect(adminOnlyDeleteRules).toHaveLength(2);
    expect(storageRules).toContain("match /{allPaths=**} {");
    expect(storageRules).toContain("allow read, write: if false;");
  });
});