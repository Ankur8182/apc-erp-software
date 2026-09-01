import React, { useEffect, useMemo, useState } from "react";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "../Styles/Header.css";
import { auth, db } from "../firebase";
import { useAuth } from "../auth/AuthProvider";
import { isFieldOnlyRole } from "../auth/authorization";
import BrandLogo from "./BrandLogo";
import { COMPANY_NAME, ERP_NAME } from "../config/branding";
import { getUserFriendlyFirebaseError } from "../utils/firebaseError";
import { captureMonitoringError } from "../utils/monitoring";
import {
  formatNotificationDate,
  generateNotifications,
  getUnreadNotificationCount,
  loadReadNotificationIds,
  saveReadNotificationIds,
} from "../utils/notifications";

const CORE_NOTIFICATION_COLLECTIONS = [
  "invoices",
  "expenses",
  "materials",
  "sites",
  "siteBudgets",
  "labours",
  "attendance",
  "salaries",
  "vehicles",
  "vehicleExpenses",
  "dailyProgressReports",
  "inventoryItems",
  "inventoryTransactions",
  "purchaseRequests",
  "purchaseOrders",
  "goodsReceipts",
  "workOrders",
  "contractorBills",
  "raBills",
  "boqItems",
  "boqMeasurements",
  "boqVariations",
];

const EMPTY_NOTIFICATION_DATA = {
  invoices: [],
  expenses: [],
  materials: [],
  sites: [],
  siteBudgets: [],
  labours: [],
  attendance: [],
  salaries: [],
  vehicles: [],
  vehicleExpenses: [],
  dailyProgressReports: [],
  inventoryItems: [],
  inventoryTransactions: [],
  purchaseRequests: [],
  purchaseOrders: [],
  goodsReceipts: [],
  workOrders: [],
  contractorBills: [],
  raBills: [],
  boqItems: [],
  boqMeasurements: [],
  boqVariations: [],
};

function Header() {
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [notificationData, setNotificationData] = useState(EMPTY_NOTIFICATION_DATA);
  const [readNotificationIds, setReadNotificationIds] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationsError, setNotificationsError] = useState("");
  const roleLabel = role
    ? `${role.charAt(0).toUpperCase()}${role.slice(1)}`
    : "User";
  const fieldOnly = isFieldOnlyRole(role);

  useEffect(() => {
    setReadNotificationIds(loadReadNotificationIds(user?.uid));
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !role) {
      setNotificationData(EMPTY_NOTIFICATION_DATA);
      setNotificationsError("");
      setNotificationsLoading(false);
      return undefined;
    }

    const fieldOnly = isFieldOnlyRole(role);
    const collectionNames = fieldOnly
      ? ["dailyProgressReports"]
      : CORE_NOTIFICATION_COLLECTIONS;
    let active = true;
    let remainingSubscriptions = collectionNames.length;

    setNotificationData(EMPTY_NOTIFICATION_DATA);
    setNotificationsError("");
    setNotificationsLoading(true);

    const completeSubscription = () => {
      remainingSubscriptions -= 1;
      if (active && remainingSubscriptions <= 0) setNotificationsLoading(false);
    };

    const unsubscribers = collectionNames.map((collectionName) => {
      const collectionReference =
        fieldOnly && collectionName === "dailyProgressReports"
          ? query(
            collection(db, collectionName),
            where("createdBy", "==", user.uid)
          )
          : collection(db, collectionName);

      return onSnapshot(
        collectionReference,
        (snapshot) => {
          if (!active) return;

          setNotificationData((currentData) => ({
            ...currentData,
            [collectionName]: snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })),
          }));
          completeSubscription();
        },
        (loadError) => {
          if (!active) return;

          void captureMonitoringError(loadError, {
            module: "notifications",
            operation: "read",
          });
          console.error("Notification data load error:", loadError);
          setNotificationsError(
            getUserFriendlyFirebaseError(
              loadError,
              "Notifications could not be refreshed. Please try again later."
            )
          );
          completeSubscription();
        }
      );
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [role, user?.uid]);

  const notifications = useMemo(
    () =>
      generateNotifications({
        role,
        userId: user?.uid,
        ...notificationData,
      }),
    [notificationData, role, user?.uid]
  );

  const unreadCount = useMemo(
    () => getUnreadNotificationCount(notifications, readNotificationIds),
    [notifications, readNotificationIds]
  );

  const updateReadNotificationIds = (nextIds) => {
    setReadNotificationIds(nextIds);
    saveReadNotificationIds(user?.uid, nextIds);
  };

  const markAsRead = (notificationId) => {
    if (readNotificationIds.includes(notificationId)) return;
    updateReadNotificationIds([...readNotificationIds, notificationId]);
  };

  const markAllAsRead = () => {
    updateReadNotificationIds(notifications.map((notification) => notification.id));
  };

  const openNotification = (notification) => {
    markAsRead(notification.id);
    setIsNotificationPanelOpen(false);
    navigate(notification.href);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      void captureMonitoringError(error, {
        module: "auth",
        operation: "authentication",
      });
      console.error("Firebase logout error:", error);
      alert("Unable to sign out. Please try again.");
    }
  };

  return (
    <div className={`header${fieldOnly ? " header-field" : ""}`}>
      <div className="header-left">
        <BrandLogo className="header-brand-logo" />
        <div className="header-brand-copy">
          <h2>{ERP_NAME}</h2>
          <span>{COMPANY_NAME}</span>
        </div>
      </div>

      <div className="header-right">
        {!fieldOnly && (
          <input
            type="text"
            placeholder="Search..."
            aria-label="Search ERP"
          />
        )}
        {fieldOnly && <span className="header-field-mode">Field mode</span>}
        <div className="header-notification-wrap">
          <button
            type="button"
            className="header-notification-btn"
            aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
            aria-expanded={isNotificationPanelOpen}
            onClick={() => setIsNotificationPanelOpen((open) => !open)}
          >
            <span aria-hidden="true">🔔</span>
            {unreadCount > 0 && (
              <span className="header-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </button>

          {isNotificationPanelOpen && (
            <div className="header-notification-panel" role="dialog" aria-label="Notifications">
              <div className="header-notification-panel-heading">
                <div>
                  <strong>Notifications</strong>
                  <small>{unreadCount ? `${unreadCount} unread` : "All caught up"}</small>
                </div>
                {notifications.length > 0 && unreadCount > 0 && (
                  <button type="button" onClick={markAllAsRead}>
                    Mark all read
                  </button>
                )}
              </div>

              <div className="header-notification-list">
                {notificationsLoading ? (
                  <p className="header-notification-state">Loading notifications...</p>
                ) : notificationsError ? (
                  <p className="header-notification-state header-notification-error">
                    {notificationsError}
                  </p>
                ) : notifications.length === 0 ? (
                  <p className="header-notification-state">No notifications right now.</p>
                ) : (
                  notifications.map((notification) => {
                    const isRead = readNotificationIds.includes(notification.id);

                    return (
                      <div
                        className={`header-notification-item header-notification-${notification.severity} ${isRead ? "is-read" : ""}`}
                        key={notification.id}
                      >
                        <button
                          type="button"
                          className="header-notification-content"
                          onClick={() => openNotification(notification)}
                        >
                          <span className="header-notification-severity">{notification.severity}</span>
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <small>{formatNotificationDate(notification.date)}</small>
                        </button>
                        {!isRead && (
                          <button
                            type="button"
                            className="header-notification-mark-read"
                            aria-label={`Mark ${notification.title} as read`}
                            onClick={() => markAsRead(notification.id)}
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="header-logout-btn"
          title="Sign out"
          aria-label="Sign out"
          onClick={handleLogout}
        >
          <span className="header-user-identity">👤 {user?.email || "User"}</span>
          <small>{roleLabel}</small>
          <strong>Logout</strong>
        </button>
      </div>
    </div>
  );
}

export default Header;
