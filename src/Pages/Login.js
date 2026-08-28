import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getAuthorizedRole } from "../auth/authorization";

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
        alert("This account is not authorized to access the ERP.");
        return;
      }

      alert("Login Successful");
      navigate("/dashboard");
    } catch (error) {
      console.error("Firebase login error:", error);
      alert("Invalid Username or Password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#f5f5f5",
      }}
    >
      <div
        style={{
          width: "350px",
          background: "#fff",
          padding: "30px",
          borderRadius: "10px",
          boxShadow: "0 0 10px rgba(0,0,0,0.2)",
        }}
      >
        <h2 style={{ textAlign: "center" }}>
          AP CONSTRUCTION ERP
        </h2>

        <p style={{ textAlign: "center" }}>
          Construction Management System
        </p>

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "10px",
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "15px",
          }}
        />

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            background: "#007bff",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          {loading ? "LOGGING IN..." : "LOGIN"}
        </button>
      </div>
    </div>
  );
}

export default Login;
