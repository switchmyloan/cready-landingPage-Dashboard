import { useState, useEffect } from "react";
import { TokenService, UserService } from ".";
import Api from "../api-services/api";

export function useAuth() {
  const [token, setToken] = useState(() => TokenService.getToken());
  const [user, setUser] = useState(() => UserService.getUser());

  const login = (accessToken, userData) => {
    TokenService.saveToken(accessToken);
    UserService.saveUser(userData);
    setToken(accessToken);
    setUser(userData);
  };

  const logout = () => {
    TokenService.removeToken();
    UserService.removeUser();
    setToken(null);
    setUser(null);
  };

  // Re-read who this user is from the server on every mount.
  //
  // The stored copy is what paints instantly; this refreshes it. Access has to
  // come from the server rather than from the token, because a token lives 12
  // hours — without this, granting or removing a module would not take effect
  // until the next day's login.
  //
  // A failure here is ignored on purpose: it leaves the cached user in place, so
  // a blip on /me can never log anybody out or blank their menu.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    Api()
      .get("/auth/me", { skipAdminAppend: true })
      .then((res) => {
        const fresh = res?.data?.data?.user;
        if (!alive || !fresh?.email) return;
        setUser((prev) => {
          const merged = { ...(prev || {}), ...fresh };
          UserService.saveUser(merged);
          return merged;
        });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [token]);

  // Check expiry every 60 seconds (not every 1 second)
  useEffect(() => {
    if (!token) return;

    const checkExpiry = () => {
      const remaining = TokenService.getRemainingTime();
      if (remaining <= 0) {
        logout();
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 60 * 1000);

    return () => clearInterval(interval);
  }, [token]);

  return {
    token,
    user,
    isAuthenticated: !!token,
    login,
    logout,
  };
}
