import { getFunctions, httpsCallable } from "firebase/functions";
import app from "../firebase";

const functions = getFunctions(app);

const callUserManagementFunction = async (name, payload) => {
  const callable = httpsCallable(functions, name);
  const response = await callable(payload);

  return response?.data || {};
};

export const listErpUsers = async () => {
  const data = await callUserManagementFunction("listErpUsers");
  return Array.isArray(data.users) ? data.users : [];
};

export const updateErpUser = async ({ userId, role, active }) => {
  const data = await callUserManagementFunction("updateErpUser", {
    userId,
    role,
    active,
  });

  return data.user || null;
};
