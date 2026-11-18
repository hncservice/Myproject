import React from "react";
import { AuthProvider } from "../features/authentication/context/AuthContext";
import Layout from "./layout/Layout";
import AppRoutes from "./routes/AppRoutes";

// Future authenticated entry: requires an existing router above this boundary.
// Deliberately not imported or mounted by the offline preview entry point.
export default function AuthenticatedApp() {
  return (
    <AuthProvider>
      <Layout>
        <AppRoutes />
      </Layout>
    </AuthProvider>
  );
}
