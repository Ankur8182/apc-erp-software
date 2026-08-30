import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";
import Layout from "../Components/Layout";
import { db, storage } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import {
  canSubmitFieldUpdate,
  getDprReadScope,
  isFieldOnlyRole,
} from "../auth/authorization";
import {
  createDprSubmitGuard,
  createFieldUpdateDprPayload,
  createInitialFieldUpdateForm,
  DPR_UNITS,
  filterDailyProgressReports,
  getDprUsageValues,
  sortDailyProgressReports,
} from "../utils/dailyProgressReporting";
import {
  createDprPhotoMetadata,
  createDprPhotoStoragePath,
  getDprPhotoMetadata,
  getDprPhotoUploadFallbackMessage,
  validateDprPhotoFiles,
} from "../utils/dprPhotos";
import {
  clearFieldUpdateDraft,
  hasFieldUpdateDraftContent,
  loadFieldUpdateDraft,
  saveFieldUpdateDraft,
} from "../utils/fieldUpdateDrafts";
import { getRecordDate, getSiteName, isSameSite } from "../utils/financialReporting";
import { getAuditFailureMessage, logAuditEvent } from "../utils/auditLogging";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import { getNetworkStatus, getOfflineFieldMessage } from "../utils/pwa";
import "../Styles/FieldUpdate.css";

const getUniqueValues = (records, getValues) => {
  const values = new Map();

  records.forEach((record) => {
    getValues(record).forEach((value) => {
      const text = String(value || "").trim();
      const key = text.toLowerCase();

      if (text && !values.has(key)) values.set(key, text);
    });
  });

  return Array.from(values.values()).sort((first, second) =>
    first.localeCompare(second)
  );
};

const uploadDprPhotos = async ({ files, userId, dprId, onProgress }) => {
  const uploadedPaths = [];
  const metadata = [];

  try {
    for (const [index, file] of files.entries()) {
      const storagePath = createDprPhotoStoragePath(
        userId,
        dprId,
        index,
        file.name
      );
      const photoReference = ref(storage, storagePath);
      uploadedPaths.push(storagePath);

      await new Promise((resolve, reject) => {
        const uploadTask = uploadBytesResumable(photoReference, file, {
          contentType: file.type,
        });

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const currentProgress = snapshot.totalBytes
              ? snapshot.bytesTransferred / snapshot.totalBytes
              : 0;
            onProgress(Math.round(((index + currentProgress) / files.length) * 100));
          },
          reject,
          async () => {
            try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              metadata.push(
                createDprPhotoMetadata({ file, storagePath, url })
              );
              resolve();
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    }

    return { metadata, uploadedPaths };
  } catch (error) {
    await Promise.all(
      uploadedPaths.map((storagePath) =>
        deleteObject(ref(storage, storagePath)).catch(() => undefined)
      )
    );
    throw error;
  }
};

function FieldUpdate() {
  const { role, user } = useAuth();
  const [sites, setSites] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [reports, setReports] = useState([]);
  const [formData, setFormData] = useState(createInitialFieldUpdateForm);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoProgress, setPhotoProgress] = useState(0);
  const [photoError, setPhotoError] = useState("");
  const [reportsLoading, setReportsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [auditWarning, setAuditWarning] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [draftUserId, setDraftUserId] = useState("");
  const [draftAvailable, setDraftAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOnline, setIsOnline] = useState(getNetworkStatus);
  const submitGuardRef = useRef(createDprSubmitGuard());

  const canSubmit = canSubmitFieldUpdate(role);
  const fieldOnly = isFieldOnlyRole(role);
  const userId = user?.uid || "";
  const dprReadScope = getDprReadScope(role, userId);

  useEffect(() => {
    const updateNetworkStatus = () => setIsOnline(getNetworkStatus());

    updateNetworkStatus();
    window.addEventListener("online", updateNetworkStatus);
    window.addEventListener("offline", updateNetworkStatus);

    return () => {
      window.removeEventListener("online", updateNetworkStatus);
      window.removeEventListener("offline", updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    if (!dprReadScope.canRead) {
      setReports([]);
      setLoadError("Your active user profile is required to load site updates.");
      setReportsLoading(false);
      return undefined;
    }

    const unsubscribeReports = onSnapshot(
      dprReadScope.createdBy
        ? query(
          collection(db, "dailyProgressReports"),
          where("createdBy", "==", dprReadScope.createdBy)
        )
        : collection(db, "dailyProgressReports"),
      (snapshot) => {
        setReports(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoadError("");
        setReportsLoading(false);
      },
      (error) => {
        console.error("Field update DPR load error:", error);
        setReports([]);
        setLoadError(
          getUserFriendlyFirebaseError(
            error,
            "Site updates could not be loaded. Please try again later."
          )
        );
        setReportsLoading(false);
      }
    );

    const unsubscribeSites = onSnapshot(
      collection(db, "sites"),
      (snapshot) => {
        setSites(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => {
        console.error("Field update sites load error:", error);
        setLoadError(
          getUserFriendlyFirebaseError(
            error,
            "Site list could not be loaded. Please try again later."
          )
        );
      }
    );

    const unsubscribeMaterials = fieldOnly
      ? () => {}
      : onSnapshot(
        collection(db, "materials"),
        (snapshot) => {
          setMaterials(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        },
        (error) => {
          console.error("Field update materials load error:", error);
          setLoadError(
            getUserFriendlyFirebaseError(
              error,
              "Reference data could not be loaded. Please try again later."
            )
          );
        }
      );

    const unsubscribeInventoryItems = onSnapshot(
      collection(db, "inventoryItems"),
      (snapshot) => {
        setInventoryItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => {
        console.error("Field update inventory load error:", error);
        setLoadError(
          getUserFriendlyFirebaseError(
            error,
            "Material availability could not be loaded. Please try again later."
          )
        );
      }
    );

    const unsubscribeVehicles = onSnapshot(
      collection(db, "vehicles"),
      (snapshot) => {
        setVehicles(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      },
      (error) => {
        console.error("Field update vehicles load error:", error);
        setLoadError(
          getUserFriendlyFirebaseError(
            error,
            "Reference data could not be loaded. Please try again later."
          )
        );
      }
    );

    return () => {
      unsubscribeReports();
      unsubscribeSites();
      unsubscribeMaterials();
      unsubscribeInventoryItems();
      unsubscribeVehicles();
    };
  }, [dprReadScope.canRead, dprReadScope.createdBy, fieldOnly]);

  useEffect(() => {
    setDraftReady(false);
    setDraftUserId("");

    if (!userId) return;

    const savedDraft = loadFieldUpdateDraft(userId);

    if (savedDraft) {
      setFormData({ ...createInitialFieldUpdateForm(), ...savedDraft });
      setDraftAvailable(true);
      setDraftMessage("Your saved draft has been restored. Photos need to be selected again.");
    } else {
      setDraftAvailable(false);
    }

    setDraftReady(true);
    setDraftUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (!draftReady || userId !== draftUserId || isSubmitting) return;

    if (hasFieldUpdateDraftContent(formData)) {
      setDraftAvailable(saveFieldUpdateDraft(userId, formData));
    } else {
      clearFieldUpdateDraft(userId);
      setDraftAvailable(false);
    }
  }, [draftReady, draftUserId, formData, isSubmitting, userId]);

  const siteNames = useMemo(
    () =>
      getUniqueValues([...sites, ...reports], (record) => [getSiteName(record)]),
    [sites, reports]
  );

  const materialNames = useMemo(
    () =>
      getUniqueValues([...(fieldOnly ? inventoryItems : materials), ...reports], (record) => [
        ...getDprUsageValues(record.materialsUsed),
        record.materialName || record.name || "",
      ]),
    [fieldOnly, inventoryItems, materials, reports]
  );

  const availableMaterialsForSelectedSite = useMemo(
    () => inventoryItems
      .filter((item) => formData.site && isSameSite(item, formData.site))
      .map((item) => ({
        ...item,
        currentStock: Math.max(Number(item.currentStock || 0), 0),
      })),
    [formData.site, inventoryItems]
  );

  const equipmentNames = useMemo(
    () =>
      getUniqueValues([...vehicles, ...reports], (record) => [
        ...getDprUsageValues(record.equipmentUsed),
        record.vehicleNumber || record.vehicleName || record.name || record.vehicleType || "",
      ]),
    [vehicles, reports]
  );

  const recentReports = useMemo(
    () =>
      sortDailyProgressReports(
        filterDailyProgressReports(reports, {
          site: formData.site || "all",
        })
      ).slice(0, 5),
    [reports, formData.site]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({ ...current, [name]: value }));
    setDraftMessage("");
  };

  const handlePhotoChange = (event) => {
    const validation = validateDprPhotoFiles(event.target.files);

    if (!validation.isValid) {
      setPhotoFiles([]);
      setPhotoError(validation.error);
      event.target.value = "";
      return;
    }

    setPhotoFiles(validation.files);
    setPhotoError("");
    setPhotoProgress(0);
  };

  const discardDraft = () => {
    clearFieldUpdateDraft(userId);
    setFormData(createInitialFieldUpdateForm());
    setPhotoFiles([]);
    setPhotoProgress(0);
    setPhotoError("");
    setDraftAvailable(false);
    setDraftMessage("Draft discarded.");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!canSubmit) {
      setSubmitError("Your role does not have permission to submit a field update.");
      return;
    }

    if (!isOnline) {
      const hasDraft = hasFieldUpdateDraftContent(formData);
      setDraftAvailable(hasDraft ? saveFieldUpdateDraft(userId, formData) : false);
      setSubmitSuccess("");
      setSubmitError("");
      setDraftMessage(hasDraft ? "Draft saved on this device. Reconnect to submit it." : "Reconnect before submitting this site update.");
      return;
    }

    if (isSubmitting || !submitGuardRef.current.begin()) return;

    const payload = createFieldUpdateDprPayload(formData, userId);

    if (!payload.isValid) {
      setSubmitError(payload.error);
      setSubmitSuccess("");
      submitGuardRef.current.release();
      return;
    }

    const photoValidation = validateDprPhotoFiles(photoFiles);

    if (!photoValidation.isValid) {
      setPhotoError(photoValidation.error);
      submitGuardRef.current.release();
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");
    setAuditWarning("");
    setDraftMessage("");
    setPhotoError("");

    let uploadedPhotoPaths = [];
    let photoUploadFallback = "";

    try {
      const reportReference = doc(collection(db, "dailyProgressReports"));
      let uploadedPhotos = { metadata: [], uploadedPaths: [] };

      if (photoValidation.files.length > 0) {
        try {
          uploadedPhotos = await uploadDprPhotos({
            files: photoValidation.files,
            userId,
            dprId: reportReference.id,
            onProgress: setPhotoProgress,
          });
          uploadedPhotoPaths = uploadedPhotos.uploadedPaths;
        } catch (photoUploadError) {
          console.error("Field update photo upload error:", photoUploadError);
          photoUploadFallback = getDprPhotoUploadFallbackMessage(photoUploadError);
          setPhotoError(photoUploadFallback);
        }
      }

      await setDoc(reportReference, {
        ...payload.value,
        photos: uploadedPhotos.metadata,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const auditResult = await logAuditEvent({
        action: "create",
        module: "dailyProgressReports",
        recordId: reportReference.id,
        recordLabel: payload.value.workActivity,
        details: "Field Daily Progress Report created.",
        site: payload.value.site,
      });
      if (!auditResult.success) setAuditWarning(getAuditFailureMessage());

      clearFieldUpdateDraft(userId);
      setFormData(createInitialFieldUpdateForm());
      setPhotoFiles([]);
      setPhotoProgress(0);
      setDraftAvailable(false);
      setSubmitSuccess(
        photoUploadFallback
          ? "Site update submitted successfully without photos."
          : "Site update submitted successfully."
      );
    } catch (error) {
      console.error("Field update save error:", error);

      if (uploadedPhotoPaths.length > 0) {
        await Promise.all(
          uploadedPhotoPaths.map((storagePath) =>
            deleteObject(ref(storage, storagePath)).catch(() => undefined)
          )
        );
      }

      setSubmitError(
        getUserFriendlyFirebaseError(
          error,
          "Site update could not be submitted. Please try again."
        )
      );
    } finally {
      setIsSubmitting(false);
      submitGuardRef.current.release();
    }
  };

  return (
    <Layout>
      <div className="field-update-page">
        <div className="field-update-heading">
          <h1>📱 Site Update</h1>
          <p>Submit today&apos;s work progress directly from site. Your draft stays on this device until Firestore confirms submission.</p>
        </div>

        {!isOnline && <p className="field-network-state field-feedback-error" role="alert">{getOfflineFieldMessage()}</p>}
        {reportsLoading && !loadError && <p className="field-network-state" role="status">Loading your site updates and operational references...</p>}

        <div className="field-update-card">
          <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
            <div className="field-update-grid">
              <div className="field-update-group">
                <label htmlFor="field-site">Site <span>*</span></label>
                <select id="field-site" name="site" value={formData.site} onChange={handleChange} disabled={!canSubmit || isSubmitting}>
                  <option value="">Select Site</option>
                  {siteNames.map((siteName) => <option key={siteName} value={siteName}>{siteName}</option>)}
                </select>
              </div>

              <div className="field-update-group">
                <label htmlFor="field-date">Date <span>*</span></label>
                <input id="field-date" type="date" name="date" value={formData.date} onChange={handleChange} disabled={!canSubmit || isSubmitting} />
              </div>

              <div className="field-update-group">
                <label htmlFor="field-activity">Work Activity <span>*</span></label>
                <input id="field-activity" type="text" name="workActivity" autoCapitalize="sentences" enterKeyHint="next" value={formData.workActivity} onChange={handleChange} placeholder="e.g. Concrete work" disabled={!canSubmit || isSubmitting} />
              </div>

              <div className="field-update-group">
                <label htmlFor="field-location">Work Location <span>*</span></label>
                <input id="field-location" type="text" name="workLocation" autoCapitalize="sentences" enterKeyHint="next" value={formData.workLocation} onChange={handleChange} placeholder="e.g. Block A" disabled={!canSubmit || isSubmitting} />
              </div>

              <div className="field-update-group">
                <label htmlFor="field-manpower">Manpower Count <span>*</span></label>
                <input id="field-manpower" type="number" min="0" step="1" inputMode="numeric" name="manpowerCount" value={formData.manpowerCount} onChange={handleChange} placeholder="0" disabled={!canSubmit || isSubmitting} />
              </div>

              <div className="field-update-group">
                <label htmlFor="field-quantity">Output Quantity <span>*</span></label>
                <input id="field-quantity" type="number" min="0" step="0.01" inputMode="decimal" name="quantity" value={formData.quantity} onChange={handleChange} placeholder="0" disabled={!canSubmit || isSubmitting} />
              </div>

              <div className="field-update-group">
                <label htmlFor="field-unit">Unit <span>*</span></label>
                <select id="field-unit" name="unit" value={formData.unit} onChange={handleChange} disabled={!canSubmit || isSubmitting}>
                  {DPR_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>

              <div className="field-update-group">
                <label htmlFor="field-material">Materials Used</label>
                <input id="field-material" type="text" name="materialsUsed" list="field-material-options" value={formData.materialsUsed} onChange={handleChange} placeholder="Select or enter material" disabled={!canSubmit || isSubmitting} />
                <datalist id="field-material-options">
                  {materialNames.map((material) => <option key={material} value={material} />)}
                </datalist>
              </div>

              <div className="field-update-group">
                <label htmlFor="field-material-quantity">Material Quantity</label>
                <input id="field-material-quantity" type="number" min="0" step="0.01" inputMode="decimal" name="materialQuantity" value={formData.materialQuantity} onChange={handleChange} placeholder="Optional" disabled={!canSubmit || isSubmitting} />
              </div>

              {fieldOnly && formData.site && (
                <div className="field-material-availability field-update-full-width">
                  <strong>📦 Material Availability at {formData.site}</strong>
                  {availableMaterialsForSelectedSite.length === 0 ? (
                    <span>No inventory availability has been recorded for this site yet.</span>
                  ) : (
                    <ul>
                      {availableMaterialsForSelectedSite.map((item) => (
                        <li key={item.id}>{item.materialName}: {item.currentStock} {item.unit || ""} available</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="field-update-group">
                <label htmlFor="field-equipment">Vehicle / Machinery Used</label>
                <input id="field-equipment" type="text" name="equipmentUsed" list="field-equipment-options" value={formData.equipmentUsed} onChange={handleChange} placeholder="Select or enter vehicle" disabled={!canSubmit || isSubmitting} />
                <datalist id="field-equipment-options">
                  {equipmentNames.map((equipment) => <option key={equipment} value={equipment} />)}
                </datalist>
              </div>

              <div className="field-update-group">
                <label htmlFor="field-equipment-usage">Equipment Usage</label>
                <input id="field-equipment-usage" type="number" min="0" step="0.01" inputMode="decimal" name="equipmentUsage" value={formData.equipmentUsage} onChange={handleChange} placeholder="Optional" disabled={!canSubmit || isSubmitting} />
              </div>

              <div className="field-update-group field-update-full-width">
                <label htmlFor="field-remarks">Remarks</label>
                <textarea id="field-remarks" name="remarks" autoCapitalize="sentences" value={formData.remarks} onChange={handleChange} placeholder="Safety, delay, weather or other notes" disabled={!canSubmit || isSubmitting} />
              </div>
            </div>

            <div className="field-photo-upload">
              <label htmlFor="field-photos">📷 Site Progress Photos</label>
              <input id="field-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple capture="environment" onChange={handlePhotoChange} disabled={!canSubmit || isSubmitting} />
              <p>Up to 5 JPG, PNG, or WebP photos. Maximum 5 MB each. Photos are not stored in drafts. If photo upload is unavailable, the site update will still be saved without photos.</p>
              {photoFiles.length > 0 && <p className="field-photo-selected">{photoFiles.length} photo{photoFiles.length > 1 ? "s" : ""} selected.</p>}
              {isSubmitting && photoFiles.length > 0 && <progress className="field-photo-progress" value={photoProgress} max="100">{photoProgress}%</progress>}
              {photoError && <p className="field-feedback field-feedback-error" role="alert">{photoError}</p>}
            </div>

            {draftAvailable && (
              <button className="field-discard-draft-btn" type="button" onClick={discardDraft} disabled={isSubmitting}>
                🗑️ Discard Draft
              </button>
            )}

            {submitError && <p className="field-feedback field-feedback-error" role="alert">{submitError}</p>}
            {auditWarning && <p className="field-feedback field-feedback-error" role="alert">{auditWarning}</p>}
            {submitSuccess && <p className="field-feedback field-feedback-success" role="status">{submitSuccess}</p>}
            {draftMessage && <p className="field-feedback field-feedback-draft" role="status">{draftMessage}</p>}

            <div className="field-submit-action-bar">
              <button className="field-submit-btn" type="submit" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? "⏳ Submitting..." : !isOnline ? "📶 Offline — reconnect to submit" : "✅ Submit Site Update"}
              </button>
            </div>
          </form>
        </div>

        <div className="field-history-card">
          <h2>🕘 Recent Site Updates</h2>

          {reportsLoading ? (
            <p className="field-state">Loading site updates...</p>
          ) : loadError ? (
            <p className="field-state field-feedback-error">{loadError}</p>
          ) : recentReports.length === 0 ? (
            <p className="field-state">No site updates found for the selected site.</p>
          ) : (
            <div className="field-history-list">
              {recentReports.map((report, index) => {
                const photoCount = getDprPhotoMetadata(report).length;

                return (
                  <div className="field-history-item" key={report.id || `field-report-${index}`}>
                    <div>
                      <strong>{report.workActivity || "Work activity not recorded"}</strong>
                      <p>{getSiteName(report) || "Site not recorded"} · {getRecordDate(report) || "Date not recorded"}</p>
                    </div>
                    <span>{report.quantity ?? "-"} {report.unit || ""} · {report.manpowerCount ?? "-"} manpower{photoCount ? ` · 📷 ${photoCount}` : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default FieldUpdate;
