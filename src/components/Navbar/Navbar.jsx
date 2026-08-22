import { useState, useEffect, useMemo } from "react";
import { Menu, Search, Bell, LogOut, User, Settings, Command, RefreshCw } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../custom-hooks/useAuth";
import { UserService } from "../../custom-hooks";
import CallbackReminders from "../CallbackReminders/CallbackReminders";
import IncredSuccessAlerts from "../IncredSuccessAlerts/IncredSuccessAlerts";
import UpSwingBankOfferAlerts from "../UpSwingBankOfferAlerts/UpSwingBankOfferAlerts";
import VivifiHotLeadsAlerts from "../VivifiHotLeadsAlerts/VivifiHotLeadsAlerts";

function Navbar({ onToggleSidebar }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const getUser = UserService.getUser();

  // "Updated X ago" status pill. lastRefreshedAt resets on every full page load
  // (mount) and on each route change (when a new page's data loads); nowTick
  // re-renders the relative label every 30s so it counts up on its own.
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => Date.now());
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    setLastRefreshedAt(Date.now());
  }, [location.pathname]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const refreshedLabel = useMemo(() => {
    const s = Math.max(0, Math.floor((nowTick - lastRefreshedAt) / 1000));
    if (s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min${m > 1 ? "s" : ""} ago`;
    const h = Math.floor(m / 60);
    return `${h} hr${h > 1 ? "s" : ""} ago`;
  }, [lastRefreshedAt, nowTick]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userInitial = getUser?.name ? getUser.name.charAt(0).toUpperCase() : 'U';
  const roleLabel = getUser?.role
    ? getUser.role.split('-').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ')
    : 'Member';

  return (
    <nav className="fixed top-0 left-0 w-full z-40 px-4 py-2 flex justify-between items-center transition-all duration-300 ease-in-out bg-white/80 backdrop-blur-xl border-b border-gray-200/70 shadow-sm">
      {/* Subtle top accent stripe */}
      <span className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-300/60 to-transparent" />

      {/* ─── LEFT SECTION ─── */}
      <div className="flex items-center gap-3">
        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-gray-500 hover:text-purple-700 hover:bg-purple-50 transition focus:outline-none focus:ring-2 focus:ring-purple-200"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>

        {/* Brand chip — visible on md+ so the navbar stays light on mobile */}
        <div className="hidden md:flex items-center gap-2">
          <span className="text-[12px] font-bold tracking-[0.16em] uppercase bg-gradient-to-r from-purple-700 via-violet-700 to-indigo-700 bg-clip-text text-transparent">
            CMS Dashboard
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9.5px] font-bold tracking-[0.12em] uppercase bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 border border-emerald-200">
            <span className="relative flex w-1 h-1">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full w-1 h-1 bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
      </div>

      {/* ─── CENTER SEARCH (md+) ─── */}
      {/* <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full group">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition" />
          <input
            type="text"
            placeholder="Search…"
            className="w-full pl-9 pr-16 py-1.5 text-[12.5px] rounded-lg bg-gray-50 border border-gray-200 outline-none transition focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 placeholder-gray-400"
          />
      
          <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white border border-gray-200 text-[10px] font-semibold text-gray-400">
            <Command size={9} /> K
          </span>
        </div>
      </div> */}

      {/* ─── RIGHT SECTION ─── */}
      <div className="flex items-center gap-2">
        {/* "Updated X ago" status pill — shows how fresh the data is so users
            don't keep refreshing. Counts up on its own; sits left of the bell. */}
        <div
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-50 text-gray-600 border border-gray-200"
          title="Time since this page loaded — refresh the browser for newer data"
        >
          <RefreshCw size={11} className="text-purple-500" />
          Updated {refreshedLabel}
        </div>

        {/* InCred success lead alerts — bell + beep + desktop notif + flash toast */}
        <IncredSuccessAlerts />

        {/* UpSwing bank-offer-available alerts — same pattern, Super Admin + CC2 only */}
        <UpSwingBankOfferAlerts />

        {/* Vivifi hot-lead alerts (awaiting VKYC / e-Sign / e-Mandate / loan-chosen) —
            shared across ALL call-center agents + Super Admin */}
        <VivifiHotLeadsAlerts />

        {/* Callback reminders bell — renders only for call-center roles */}
        <CallbackReminders />

        {/* Vertical divider */}
        <span className="hidden sm:inline-block w-px h-6 bg-gray-200" />

        {/* User profile chip */}
        <div className="dropdown dropdown-end">
          <div
            tabIndex={0}
            role="button"
            className="group flex items-center gap-2 p-1 pr-2 rounded-full hover:bg-purple-50 transition cursor-pointer"
          >
            <div className="relative flex-shrink-0">
              {/* Soft glow */}
              <span className="absolute inset-0 rounded-full bg-purple-400/30 blur-sm" />
              <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-600 flex items-center justify-center text-white font-bold text-[12px] leading-none shadow-md ring-2 ring-white">
                {userInitial}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-start min-w-0 leading-tight">
              <span className="text-[11.5px] font-semibold text-gray-800 truncate max-w-[120px]">
                {getUser?.name || getUser?.email?.split('@')[0] || 'Member'}
              </span>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-purple-600/80 truncate max-w-[120px]">
                {roleLabel}
              </span>
            </div>
          </div>

          {/* Dropdown */}
          <ul
            tabIndex={0}
            className="menu menu-sm dropdown-content mt-3 z-[1] p-0 shadow-2xl shadow-purple-500/10 bg-white rounded-2xl w-72 text-black border border-gray-200/80 overflow-hidden"
          >
            {/* Header gradient */}
            <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50 overflow-hidden">
              {/* Decorative blob */}
              <span className="absolute -top-10 -right-10 w-28 h-28 rounded-full bg-purple-300/30 blur-2xl pointer-events-none" />
              <div className="relative flex flex-col items-center text-center">
                <div className="relative mb-2">
                  <span className="absolute inset-0 rounded-full bg-purple-400/40 blur-md" />
                  <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 via-violet-600 to-indigo-700 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/30 ring-2 ring-white">
                    {userInitial}
                  </div>
                </div>
                <p className="font-bold text-gray-900 text-[14px] leading-tight">
                  {getUser?.name || 'Member'}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5 truncate max-w-full">
                  {getUser?.email}
                </p>
                <span className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white text-purple-700 border border-purple-200 shadow-sm">
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* Options */}
            <div className="p-2 space-y-0.5">
              <li>
                <a className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition">
                  <User size={14} /> Profile
                </a>
              </li>
              <li>
                <a className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition">
                  <Settings size={14} /> Settings
                </a>
              </li>
              <div className="my-1 h-px bg-gray-100" />
              <li>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition"
                >
                  <LogOut size={14} /> Logout
                </button>
              </li>
            </div>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;