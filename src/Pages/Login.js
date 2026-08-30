import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import BrandLogo from "../Components/BrandLogo";
import { BRAND_TAGLINE, COMPANY_NAME, ERP_NAME } from "../config/branding";
import { auth, db } from "../firebase";
import { getAuthorizedRole, getRoleLandingPath } from "../auth/authorization";
import "../Styles/Branding.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      alert("Email and Password are required.");
      return;
    }

    try {
      setLoading(true);
      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );
      const profileSnapshot = await getDoc(
        doc(db, "users", credential.user.uid)
      );
      const role = profileSnapshot.exists()
        ? getAuthorizedRole(profileSnapshot.data())
        : null;

      if (!role) {
        await signOut(auth);
        alert("This account does not have an active ERP role. Contact an administrator.");
        return;
      }

      alert("Login Successful");
      navigate(getRoleLandingPath(role));
    } catch (error) {
      console.error("Firebase login error:", error);
      alert("Invalid Username or Password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <BrandLogo className="login-brand-logo" />
          <p className="login-company-name">{COMPANY_NAME}</p>
          <h1 className="login-erp-name">{ERP_NAME}</h1>
          <p className="login-tagline">{BRAND_TAGLINE}</p>
        </div>

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        <button
          type="button"
          className="login-submit-button"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "LOGGING IN..." : "LOGIN"}
        </button>
      </div>
    </div>
  );
}

export default Login;