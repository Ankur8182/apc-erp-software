import {
  clearFieldUpdateDraft,
  getFieldUpdateDraftKey,
  hasSavedFieldUpdateDraft,
  loadFieldUpdateDraft,
  saveFieldUpdateDraft,
} from "./fieldUpdateDrafts";

const createStorage = () => {
  const values = new Map();

  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test("saves and restores a local field-update draft without photo data", () => {
  const storage = createStorage();
  const userId = "supervisor-1";

  expect(
    saveFieldUpdateDraft(
      userId,
      {
        site: "Civil Site",
        workActivity: "PCC",
        workLocation: "Block A",
        quantity: "10",
        manpowerCount: "6",
        photos: ["not persisted"],
      },
      storage
    )
  ).toBe(true);

  expect(loadFieldUpdateDraft(userId, storage)).toMatchObject({
    site: "Civil Site",
    workActivity: "PCC",
    quantity: "10",
    manpowerCount: "6",
  });
  expect(loadFieldUpdateDraft(userId, storage)).not.toHaveProperty("photos");
  expect(hasSavedFieldUpdateDraft(userId, storage)).toBe(true);
});

test("does not save empty drafts and clears saved drafts safely", () => {
  const storage = createStorage();
  const userId = "engineer-1";

  expect(saveFieldUpdateDraft(userId, { date: "2026-09-01" }, storage)).toBe(false);
  expect(getFieldUpdateDraftKey(userId)).toContain(userId);

  saveFieldUpdateDraft(userId, { site: "LKO" }, storage);
  expect(clearFieldUpdateDraft(userId, storage)).toBe(true);
  expect(loadFieldUpdateDraft(userId, storage)).toBeNull();
});
