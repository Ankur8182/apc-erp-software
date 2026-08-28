import React, { createContext, useContext, useEffect, useState } from "react";
import { onSnapshot, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { getAuthorizedRole } from "./authorization";

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

          setState({
            user,
            role: isAuthorized ? role : null,
            isAuthorized,
            loading: false,
          });
        },
        (error) => {
          console.error("ERP authorization profile error:", error);
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
