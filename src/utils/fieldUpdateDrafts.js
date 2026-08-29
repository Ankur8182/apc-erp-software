const DRAFT_PREFIX = "ap-construction-field-update-draft-v1";
export const FIELD_DRAFT_EVENT = "ap-construction-field-draft-changed";

const DRAFT_FIELDS = [
  "date",
  "site",
  "workActivity",
  "workLocation",
  "quantity",
  "unit",
  "manpowerCount",
  "materialsUsed",
  "materialQuantity",
  "equipmentUsed",
  "equipmentUsage",
  "remarks",
];

const getStorage = (storage) => {
  if (storage) return storage;

  return typeof window !== "undefined" ? window.localStorage : null;
};

const normaliseString = (value) => String(value ?? "");

export const getFieldUpdateDraftKey = (userId) =>
  userId ? `${DRAFT_PREFIX}:${userId}` : "";

export const normaliseFieldUpdateDraft = (form = {}) =>
  DRAFT_FIELDS.reduce(
    (draft, field) => ({ ...draft, [field]: normaliseString(form[field]) }),
    {}
  );

export const hasFieldUpdateDraftContent = (form = {}) =>
  [
    "site",
    "workActivity",
    "workLocation",
    "quantity",
    "manpowerCount",
    "materialsUsed",
    "materialQuantity",
    "equipmentUsed",
    "equipmentUsage",
    "remarks",
  ].some((field) => normaliseString(form[field]).trim() !== "");

export const notifyFieldDraftChange = () => {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new Event(FIELD_DRAFT_EVENT));
  }
};

export const saveFieldUpdateDraft = (userId, form, storage) => {
  const draftKey = getFieldUpdateDraftKey(userId);
  const targetStorage = getStorage(storage);

  if (!draftKey || !targetStorage || !hasFieldUpdateDraftContent(form)) {
    return false;
  }

  try {
    targetStorage.setItem(
      draftKey,
      JSON.stringify({
        form: normaliseFieldUpdateDraft(form),
        savedAt: new Date().toISOString(),
      })
    );
    notifyFieldDraftChange();
    return true;
  } catch (error) {
    console.error("Field draft save error:", error);
    return false;
  }
};

export const loadFieldUpdateDraft = (userId, storage) => {
  const draftKey = getFieldUpdateDraftKey(userId);
  const targetStorage = getStorage(storage);

  if (!draftKey || !targetStorage) return null;

  try {
    const savedDraft = targetStorage.getItem(draftKey);
    const parsedDraft = savedDraft ? JSON.parse(savedDraft) : null;

    return parsedDraft?.form && typeof parsedDraft.form === "object"
      ? normaliseFieldUpdateDraft(parsedDraft.form)
      : null;
  } catch (error) {
    console.error("Field draft restore error:", error);
    return null;
  }
};

export const clearFieldUpdateDraft = (userId, storage) => {
  const draftKey = getFieldUpdateDraftKey(userId);
  const targetStorage = getStorage(storage);

  if (!draftKey || !targetStorage) return false;

  try {
    targetStorage.removeItem(draftKey);
    notifyFieldDraftChange();
    return true;
  } catch (error) {
    console.error("Field draft clear error:", error);
    return false;
  }
};

export const hasSavedFieldUpdateDraft = (userId, storage) =>
  Boolean(loadFieldUpdateDraft(userId, storage));
