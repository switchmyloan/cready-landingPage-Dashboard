// // src/components/ProtectedRoute.jsx
// import { Navigate, Outlet  } from "react-router-dom";
// import { useAuth } from "../custom-hooks/useAuth";

// function ProtectedRoute() {
//   const { token } = useAuth();
//      console.log(token, "outside")
//   if (!token) {
//      console.log(token, "inside")
//     return <Navigate to="/login" replace />;
//   }

// return <Outlet />;
// }

// export default ProtectedRoute;



// src/components/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../custom-hooks/useAuth";
import { routes } from "../routes/routes";

export default function ProtectedRoute() {
  const { token, user } = useAuth();
  // useLocation() (NOT the global window.location) so this component RE-RENDERS on
  // every client-side navigation and re-runs the role check. With window.location it
  // only ran once at mount, letting an agent open any route (e.g. /disbursal-dashboard)
  // by navigating in-app.
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Match the route by exact path (trailing slash tolerant). Detail/param routes
  // aren't listed in routes.js, so they fall through to their parent's access.
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  const currentRoute = routes.find((r) => r.path === pathname);

  // `dev` is a super-role — full access to EVERY module (bypasses the per-route
  // role gate, including any routes added later). No need to list it per route.
  const isDev = user?.role === "dev";

  if (currentRoute?.roles && !isDev && !currentRoute.roles.includes(user?.role)) {
    // Logged in but this route isn't allowed for the role → bounce to the first
    // route the role CAN open (so a call-center agent lands on Offer Leads, not the
    // login screen). Falls back to /login if the role has no allowed route.
    const fallback = routes.find((r) => r.roles?.includes(user?.role))?.path || "/login";
    return <Navigate to={fallback} replace />;
  }

  return <Outlet />;
}
