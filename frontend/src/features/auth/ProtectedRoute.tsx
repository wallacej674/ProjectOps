import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { safeAuthRedirect } from "./AuthPage";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.authenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }
  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const redirect = safeAuthRedirect(new URLSearchParams(location.search).get("redirect"));
  if (auth.authenticated) return <Navigate to={redirect} replace />;
  return <>{children}</>;
}
