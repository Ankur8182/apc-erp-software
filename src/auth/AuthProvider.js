import React, { createContext, useContext, useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { getAuthorizedRole } from "./authorization";
import {
  captureMonitoringError,
  clearMonitoringActor,
  setMonitoringActor,
} from "../utils/monitoring";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    user: null,
    role: null,
    isAuthorized: false,
    loading: true,
  });

  useEffect(() => {
    let unsubscribeProfile = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeProfile();
      clearMonitoringActor();

      if (!user) {
        setState({
          user: null,
          role: null,
          isAuthorized: false,
          loading: false,
        });
        return;
      }

      setState({
        user,
        role: null,
        isAuthorized: false,
        loading: true,
      });

      unsubscribeProfile = onSnapshot(
        doc(db, "users", user.uid),
        (profileSnapshot) => {
          const profile = profileSnapshot.data();
          const role = profileSnapshot.exists()
            ? getAuthorizedRole(profile)
            : null;
          const isAuthorized = Boolean(role);

          if (isAuthorized) {
            setMonitoringActor({ userId: user.uid, userRole: role });
          } else {
            clearMonitoringActor();
          }

          setState({
            user,
            role: isAuthorized ? role : null,
            isAuthorized,
            loading: false,
          });
        },
        (error) => {
          // A known active account is retained in the in-memory monitoring actor
          // until this failure has been reported. Users never see raw details.
          void captureMonitoringError(error, {
            module: "auth",
            operation: "read",
          });
          console.error("ERP authorization profile error:", error);
          clearMonitoringActor();
          setState({
            user,
            role: null,
            isAuthorized: false,
            loading: false,
          });
        }
      );
    });

    return () => {
      unsubscribeProfile();
      unsubscribeAuth();
      clearMonitoringActor();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}