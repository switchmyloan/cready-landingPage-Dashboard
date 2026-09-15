import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  RefreshCw,
  X,
  Trash2,
  Pencil,
  ShieldCheck,
  Users as UsersIcon,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { routes } from "../../routes/routes";
import { useAuth } from "../../custom-hooks/useAuth";
import ToastNotification from "../../components/Notification/ToastNotification";
import {
  getCmsUsers,
  createCmsUser,
  updateCmsUser,
  setCmsUserModules,
  getCmsModules,
  createCmsModule,
  updateCmsModule,
  deleteCmsModule,
  syncCmsModules,
} from "../../api-services/Modules/AccessControl";

/* Access Control — dev only.
 *
 * Two things live here: WHO exists, and WHAT they can open. They are one screen
 * because they are one decision — you almost never add a user without deciding
 * their modules in the same breath.
 *
 * The rule the whole page rests on: a user with NO modules ticked falls back to
 * their ROLE's defaults (the roles in routes.js). That is what makes this safe to
 * roll out — nobody's access changes until someone is explicitly given a list.
 * The UI has to keep saying so, because "no ticks" reading as "no access" would
 * be the obvious and wrong assumption.
 */

const ROLES = [
  "super-admin", "admin", "management", "marketing", "dev",
  "mv-admin", "mv-page", "mv-page-admin", "short-page-admin",
  "kb-admin", "kb-mumbai", "kb-banglore", "call-center", "campaign-team",
];

// The app's own route list, in the shape the registry stores.
const routeCatalogue = () =>
  routes
    .filter((r) => r.path && r.label && r.roles)
    .map((r) => ({ key: r.path, label: r.label, group: r.group || null, sortOrder: r.order || 0 }))
    .filter((m, i, all) => all.findIndex((x) => x.key === m.key) === i);

const Field = ({ label, children }) => (
  <label className="block">
    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
    {children}
  </label>
);

// Modal forms keep the taller field; the page itself uses the compact one.
const input =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100";

const field =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-gray-400";

// Secondary actions all look the same and none of them shout. Only Save is filled.
const ghostBtn =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-gray-600 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700";

/* Furniture, all at module scope. */

const TONE = {
  purple: "text-purple-700",
  emerald: "text-emerald-600",
  rose: "text-rose-600",
  gray: "text-gray-800",
};

// `field` carries w-full, and a w-auto written after it does NOT win — Tailwind
// resolves by CSS order, not by class-string order. That is why the select used
// to eat the whole row and push everything else onto its own line.
const selectCls =
  "shrink-0 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-[12.5px] text-gray-600 outline-none transition focus:border-purple-400";

/** One KPI reading, sized to sit in the header line rather than own a row. */
const Stat = ({ label, value, hint, tone = "gray" }) => (
  <div className="text-right" title={hint}>
    <div className="text-[9.5px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
    <div className={`font-mono text-[17px] font-bold leading-tight tabular-nums ${TONE[tone]}`}>{value}</div>
  </div>
);

const Switch = ({ on, onClick, title }) => (
  <button
    type="button"
    onClick={onClick}
    role="switch"
    aria-checked={on}
    title={title}
    className={`relative h-4 w-[30px] shrink-0 rounded-full transition ${
      on ? "bg-emerald-500 shadow-sm shadow-emerald-500/30" : "bg-gray-300"
    }`}
  >
    <span
      className={`absolute top-[3px] h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${
        on ? "left-[17px]" : "left-[3px]"
      }`}
    />
  </button>
);

/** Initials tile. Gives the user list a spine to scan down. */
const Avatar = ({ name, active }) => (
  <span
    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11.5px] font-bold ${
      active
        ? "bg-gradient-to-br from-purple-600 to-violet-600 text-white shadow-sm shadow-purple-500/30"
        : "bg-gray-100 text-gray-500"
    }`}
  >
    {(name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
  </span>
);

export default function AccessControl() {
  const { user } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState(null);   // email being edited
  const [draft, setDraft] = useState([]);           // module keys ticked
  const [saving, setSaving] = useState(false);
  // Modules tab: 48 rows needs a filter, and a group jump.
  const [modSearch, setModSearch] = useState("");
  const [modGroup, setModGroup] = useState("");      // "" = all groups
  const [showOff, setShowOff] = useState(true);      // include switched-off ones

  const [showNewUser, setShowNewUser] = useState(false);
  const [showNewModule, setShowNewModule] = useState(false);
  const [editUser, setEditUser] = useState(null);   // the user object being edited
  const [editModule, setEditModule] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, m] = await Promise.all([getCmsUsers(), getCmsModules(true)]);
      setUsers(u?.data?.data || []);
      setModules(m?.data?.data || []);
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || "Could not load access data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Register any route the app has that the registry does not. Runs once the
  // modules are loaded, so adding a page in code is enough — nobody has to
  // remember to add it here, and a hand-typed key can't be silently wrong.
  useEffect(() => {
    if (loading || !modules) return;
    const known = new Set(modules.map((m) => m.key));
    const missing = routeCatalogue().filter((m) => !known.has(m.key));
    if (!missing.length) return;
    syncCmsModules(routeCatalogue())
      .then((res) => {
        if (res?.data?.data?.inserted) {
          ToastNotification.success(`${res.data.data.inserted} new module(s) registered`);
          load();
        }
      })
      .catch(() => { /* registry not migrated yet — the page still works read-only */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const shownUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q),
    );
  }, [users, search]);

  const grouped = useMemo(() => {
    const by = new Map();
    modules.forEach((m) => {
      const g = m.group || "Other";
      if (!by.has(g)) by.set(g, []);
      by.get(g).push(m);
    });
    return [...by.entries()];
  }, [modules]);

  // Groups with their counts — what the chips are built from.
  const groupCounts = useMemo(() => {
    const by = new Map();
    modules.forEach((m) => {
      const g = m.group || "Other";
      by.set(g, (by.get(g) || 0) + 1);
    });
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [modules]);

  // The Modules tab's own view: search + group + on/off, grouped for display.
  const shownModules = useMemo(() => {
    const q = modSearch.trim().toLowerCase();
    const list = modules.filter((m) => {
      if (!showOff && !m.isActive) return false;
      if (modGroup && (m.group || "Other") !== modGroup) return false;
      if (!q) return true;
      return (
        m.label?.toLowerCase().includes(q)
        || m.key?.toLowerCase().includes(q)
        || (m.group || "").toLowerCase().includes(q)
      );
    });
    const by = new Map();
    list.forEach((m) => {
      const g = m.group || "Other";
      if (!by.has(g)) by.set(g, []);
      by.get(g).push(m);
    });
    return [...by.entries()];
  }, [modules, modSearch, modGroup, showOff]);

  const offCount = useMemo(() => modules.filter((m) => !m.isActive).length, [modules]);

  // What the KPI strip reports. `custom` is the number worth watching: everyone
  // else is on their role's defaults, which is the safe, untouched state.
  const customCount = useMemo(() => users.filter((u) => !u.usesRoleDefaults).length, [users]);

  // Tick or untick a whole group at once. Assigning access group-by-group is how
  // it is actually done — a call-centre user gets all of Lead Management, not
  // eleven individually hunted checkboxes.
  const toggleGroup = (list) => {
    const keys = list.map((m) => m.key);
    const allOn = keys.every((k) => draft.includes(k));
    setDraft((d) => (allOn ? d.filter((k) => !keys.includes(k)) : [...new Set([...d, ...keys])]));
  };

  const toggleModule = async (m) => {
    try {
      await updateCmsModule(m.id, { isActive: !m.isActive });
      load();
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || "Could not change that");
    }
  };

  const openUser = (u) => {
    setSelected(u.email);
    setDraft(u.modules || []);
  };

  const toggle = (key) =>
    setDraft((d) => (d.includes(key) ? d.filter((k) => k !== key) : [...d, key]));

  const saveModules = async () => {
    setSaving(true);
    try {
      await setCmsUserModules(selected, draft);
      ToastNotification.success("Access updated");
      setSelected(null);
      load();
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== "dev") {
    return <div className="p-8 text-[13px] text-gray-500">This screen is available to the developer account only.</div>;
  }

  const editing = users.find((u) => u.email === selected);

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4">
      {/* Header on ONE line: identity left, the four readings right. The KPI strip
          used to own its own 90px band, which is 90px that 48 modules needed. */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="h-[3px] bg-gradient-to-r from-purple-500 via-violet-500 to-purple-500" />
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-gradient-to-br from-white via-purple-50/30 to-violet-50/20 px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-purple-600 via-violet-600 to-purple-700 text-white shadow-sm shadow-purple-500/30 ring-1 ring-white/40">
              <ShieldCheck size={17} />
            </span>
            <div>
              <h1 className="text-[14.5px] font-bold tracking-tight text-gray-900">Access Control</h1>
              <p className="text-[11px] text-gray-500">Who exists in the CMS, and what each person can open.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Stat label="Users" value={users.length} hint={`${users.length - customCount} follow their role's defaults`} />
            <span className="h-7 w-px bg-gray-200" />
            <Stat label="Custom" value={customCount} tone="purple" hint="Users whose ticked modules override their role" />
            <span className="h-7 w-px bg-gray-200" />
            <Stat label="Live" value={modules.length - offCount} tone="emerald" hint={`${modules.length} routes registered`} />
            <span className="h-7 w-px bg-gray-200" />
            <Stat label="Off" value={offCount} tone={offCount ? "rose" : "gray"} hint="Switched off for everyone" />
            <button
              type="button"
              onClick={load}
              title="Reload"
              className="ml-1 rounded-lg border border-gray-300 bg-white p-2 text-gray-600 transition hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs and this tab's own filters share one row. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          {[
            { k: "users", label: "Users", icon: <UsersIcon size={13} />, n: users.length },
            { k: "modules", label: "Modules", icon: <Layers size={13} />, n: modules.length },
          ].map(({ k, label, icon, n }) => (
            <button
              key={k}
              type="button"
              onClick={() => { setTab(k); setSelected(null); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition ${
                tab === k
                  ? "bg-purple-600 text-white shadow-sm shadow-purple-500/30"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
              }`}
            >
              {icon} {label}
              <span className={`font-mono text-[11px] tabular-nums ${tab === k ? "text-purple-200" : "text-gray-400"}`}>{n}</span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[200px] max-w-[320px] flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={tab === "users" ? search : modSearch}
            onChange={(e) => (tab === "users" ? setSearch(e.target.value) : setModSearch(e.target.value))}
            placeholder={tab === "users" ? "Name, email or role…" : "Name or route…"}
            className={`${field} pl-8`}
          />
        </div>

        {tab === "modules" && (
          <>
            <select value={modGroup} onChange={(e) => setModGroup(e.target.value)} className={selectCls}>
              <option value="">All groups</option>
              {groupCounts.map(([g, n]) => (
                <option key={g} value={g}>{g} ({n})</option>
              ))}
            </select>

            {offCount > 0 && (
              <label className="flex shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-200 bg-white px-2.5 py-[7px] text-[12px] text-gray-600">
                <input
                  type="checkbox"
                  checked={showOff}
                  onChange={() => setShowOff((v) => !v)}
                  className="h-3.5 w-3.5 accent-purple-600"
                />
                Show {offCount} off
              </label>
            )}
          </>
        )}

        <button
          type="button"
          onClick={() => (tab === "users" ? setShowNewUser(true) : setShowNewModule(true))}
          className={ghostBtn}
          title={tab === "users" ? "Add a CMS user" : "Register a route"}
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {loading ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white py-20 text-center text-[13px] text-gray-400 shadow-sm">
          Loading…
        </div>
      ) : tab === "users" ? (
        !editing ? (
          /* Everyone at once. The old layout spent half the screen on an empty
             panel while making 22 people scroll inside 320px. */
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {shownUsers.map((u) => (
              <button
                key={u.email}
                type="button"
                onClick={() => openUser(u)}
                title={u.usesRoleDefaults
                  ? `${u.name} follows the ${u.role} role's own access`
                  : `${u.name} has ${u.modules.length} module(s) set directly, which replace the ${u.role} role`}
                className={`flex items-center gap-2.5 rounded-xl border border-l-[3px] bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-purple-300 hover:shadow-md ${
                  u.usesRoleDefaults ? "border-gray-200 border-l-gray-200" : "border-gray-200 border-l-purple-500"
                }`}
              >
                <Avatar name={u.name} active={!u.usesRoleDefaults} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-gray-800">{u.name}</div>
                  <div className="truncate text-[10.5px] text-gray-400">{u.email}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="rounded bg-gray-100 px-1.5 py-px font-mono text-[9.5px] font-semibold text-gray-600">
                    {u.role}
                  </span>
                  {/* The distinction the whole page rests on: nothing ticked means
                      they follow their ROLE, not that they get nothing. */}
                  {u.usesRoleDefaults ? (
                    <span className="text-[9.5px] text-gray-400">role default</span>
                  ) : (
                    <span className="font-mono text-[9.5px] font-bold tabular-nums text-purple-700">
                      {u.modules.length} module{u.modules.length === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </button>
            ))}

            {!shownUsers.length && (
              <div className="col-span-full rounded-xl border border-gray-200 bg-white px-4 py-16 text-center text-[12.5px] text-gray-400 shadow-sm">
                No users match that.
              </div>
            )}
          </div>
        ) : (
          /* One user, the whole width. */
          <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 via-white to-purple-50/40 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  title="Back to everyone"
                  className="rounded-lg border border-gray-200 bg-white p-1.5 text-gray-500 transition hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700"
                >
                  <ArrowLeft size={14} />
                </button>
                <Avatar name={editing.name} active />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-gray-900">{editing.name}</div>
                  <div className="truncate text-[10.5px] text-gray-500">
                    {editing.email} &middot; <span className="font-mono">{editing.role}</span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="mr-1 hidden sm:block">
                  <div className="font-mono text-[11px] tabular-nums text-gray-500">
                    <span className={draft.length ? "font-bold text-purple-700" : ""}>{draft.length}</span> / {modules.length}
                  </div>
                  <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-500 transition-all"
                      style={{ width: `${modules.length ? (draft.length / modules.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <button type="button" onClick={() => setEditUser(editing)} className={ghostBtn} title="Name, role, phone, password">
                  <Pencil size={12} /> Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDraft([])}
                  className={ghostBtn}
                  title="Clear every tick so this user follows their role again"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={saveModules}
                  disabled={saving}
                  className="rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 px-3.5 py-2 text-[12.5px] font-semibold text-white shadow-sm shadow-purple-500/30 transition hover:from-purple-700 hover:to-violet-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            <p className="border-b border-gray-100 px-3 py-1.5 text-[11px] text-gray-500">
              {draft.length === 0
                ? "Nothing ticked — this user follows their role's own access."
                : "Ticked modules replace the role's access entirely."}
            </p>

            {/* Columns, not rows: every group is one unbreakable block and the
                blocks flow down the columns, so all 48 are on screen. */}
            <div className="columns-2 gap-4 p-3 lg:columns-3 2xl:columns-4">
              {grouped.map(([group, list]) => {
                const n = list.filter((m) => draft.includes(m.key)).length;
                return (
                  <div key={group} className="mb-3 break-inside-avoid">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{group}</span>
                      <span className={`font-mono text-[10px] tabular-nums ${n ? "text-purple-600" : "text-gray-300"}`}>
                        {n}/{list.length}
                      </span>
                      <span className="h-px flex-1 bg-gray-100" />
                      <button
                        type="button"
                        onClick={() => toggleGroup(list)}
                        className="text-[10px] font-semibold text-gray-400 transition hover:text-purple-600"
                      >
                        {n === list.length ? "clear" : "all"}
                      </button>
                    </div>
                    {list.map((m) => (
                      <label
                        key={m.key}
                        className={`flex cursor-pointer items-center gap-1.5 rounded px-1 py-[3px] text-[12px] transition ${
                          draft.includes(m.key)
                            ? "bg-purple-50/70 font-medium text-purple-900"
                            : "text-gray-600 hover:bg-gray-50"
                        } ${m.isActive ? "" : "opacity-40"}`}
                        title={m.isActive ? m.key : `${m.key} — switched off for everyone`}
                      >
                        <input
                          type="checkbox"
                          checked={draft.includes(m.key)}
                          onChange={() => toggle(m.key)}
                          className="h-3 w-3 shrink-0 accent-purple-600"
                        />
                        <span className="truncate">{m.label}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        /* Modules — every group a block, blocks flowing down columns. No inner
           scroll: the whole registry is meant to be readable at a glance. */
        <>
          <div className="mt-3 columns-1 gap-3 sm:columns-2 lg:columns-3 2xl:columns-4">
            {shownModules.map(([group, list]) => (
              <div
                key={group}
                className="mb-3 break-inside-avoid overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50/80 px-3 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{group}</span>
                  <span className="font-mono text-[10px] tabular-nums text-gray-400">{list.length}</span>
                </div>

                {list.map((m) => (
                  <div
                    key={m.id}
                    className="group flex items-center gap-2 border-b border-gray-50 px-2.5 py-[5px] transition last:border-b-0 hover:bg-purple-50/40"
                    title={m.key}
                  >
                    {/* A column of dots reads on/off faster than a column of
                        switches — the switch is for changing, the dot for seeing. */}
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.isActive ? "bg-emerald-500" : "bg-gray-300"}`} />

                    <span className={`min-w-0 flex-1 truncate text-[12px] ${m.isActive ? "text-gray-800" : "text-gray-400"}`}>
                      {m.label}
                    </span>

                    {/* Route lives in the tooltip. As a second line it doubled the
                        height of all 48 rows to show something rarely read. */}
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setEditModule(m)}
                        title="Rename, regroup or reorder"
                        className="rounded p-1 text-gray-400 transition hover:bg-white hover:text-purple-600"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          // Deleting drops every grant with it. Switching off keeps
                          // the record of who had access.
                          if (!window.confirm(`Delete "${m.label}"? Everyone's access to it goes too.\n\nTo just take it away from everyone, switch it off instead.`)) return;
                          await deleteCmsModule(m.id);
                          load();
                        }}
                        title="Delete permanently"
                        className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <Switch
                      on={m.isActive}
                      onClick={() => toggleModule(m)}
                      title={m.isActive ? `${m.key} is live — click to hide it from everyone` : `${m.key} is off — click to bring it back`}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>

          {!shownModules.length && (
            <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-16 text-center text-[12.5px] text-gray-400 shadow-sm">
              Nothing matches.{" "}
              <button
                type="button"
                className="font-semibold text-purple-600 underline-offset-2 hover:underline"
                onClick={() => { setModSearch(""); setModGroup(""); setShowOff(true); }}
              >
                Clear filters
              </button>
            </div>
          )}

          <p className="mt-1 text-[10.5px] text-gray-400">
            Registered from the app&apos;s own routes — hover a row for its path. A row here does not create a page; the page must exist in code.
          </p>
        </>
      )}

      {/* New user */}
      {showNewUser && (
        <Modal title="Add user" onClose={() => setShowNewUser(false)}>
          <NewUserForm
            onDone={() => { setShowNewUser(false); load(); }}
          />
        </Modal>
      )}

      {/* Edit user */}
      {editUser && (
        <Modal title={`Edit ${editUser.name}`} onClose={() => setEditUser(null)}>
          <EditUserForm
            user={editUser}
            onDone={() => { setEditUser(null); load(); }}
          />
        </Modal>
      )}

      {/* Edit module */}
      {editModule && (
        <Modal title={`Edit ${editModule.label}`} onClose={() => setEditModule(null)}>
          <EditModuleForm
            module={editModule}
            onDone={() => { setEditModule(null); load(); }}
          />
        </Modal>
      )}

      {/* New module */}
      {showNewModule && (
        <Modal title="Add module" onClose={() => setShowNewModule(false)}>
          <NewModuleForm
            existing={modules.map((m) => m.key)}
            onDone={() => { setShowNewModule(false); load(); }}
          />
        </Modal>
      )}
    </div>
  );
}

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
    <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-gray-900">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
          <X size={16} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const NewUserForm = ({ onDone }) => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "call-center", password: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createCmsUser(form);
      ToastNotification.success("User created");
      onDone();
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || "Could not create user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Name"><input className={input} value={form.name} onChange={set("name")} required /></Field>
      <Field label="Email"><input className={input} type="email" value={form.email} onChange={set("email")} required /></Field>
      <Field label="Phone (optional)">
        <input className={input} value={form.phone} onChange={set("phone")} placeholder="10 digits" maxLength={10} />
      </Field>
      <Field label="Role">
        <select className={input} value={form.role} onChange={set("role")}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Password">
        {/* Hashed on the server; the plain text is never stored and cannot be read
            back later, so it has to be handed to the person now. */}
        <input className={input} type="text" value={form.password} onChange={set("password")} minLength={8} required />
      </Field>
      <p className="text-[11px] text-gray-400">
        New users start on their role's defaults. Tick modules afterwards only if they need something different.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-purple-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
      >
        {busy ? "Creating…" : "Create user"}
      </button>
    </form>
  );
};

const EditUserForm = ({ user, onDone }) => {
  const [form, setForm] = useState({
    name: user.name || "",
    role: user.role || "",
    phone: user.phone || "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      // Only send what changed. Sending every field would rewrite the password
      // hash on an edit that only meant to fix a typo in someone's name.
      const patch = {};
      if (form.name !== user.name) patch.name = form.name;
      if (form.role !== user.role) patch.role = form.role;
      if (form.phone !== (user.phone || "")) patch.phone = form.phone;
      if (form.password) patch.password = form.password;
      if (!Object.keys(patch).length) { onDone(); return; }

      await updateCmsUser(user.email, patch);
      ToastNotification.success("User updated");
      onDone();
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || "Could not update user");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    // Disabled, not deleted: the row stays so old audit logs still resolve to a
    // real person, and the module grants survive if they come back.
    if (!window.confirm(`Disable ${user.name}? They will not be able to log in.`)) return;
    setBusy(true);
    try {
      await updateCmsUser(user.email, { isActive: false });
      ToastNotification.success("User disabled");
      onDone();
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || "Could not disable user");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Email">
        {/* Not editable: it is the login identity and the key every grant and log
            line points at. Changing it belongs in a deliberate migration, not a
            text box. */}
        <input className={`${input} bg-gray-50 text-gray-500`} value={user.email} disabled />
      </Field>
      <Field label="Name"><input className={input} value={form.name} onChange={set("name")} required /></Field>
      <Field label="Role">
        <select className={input} value={form.role} onChange={set("role")}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
      <Field label="Phone">
        <input className={input} value={form.phone} onChange={set("phone")} placeholder="10 digits" maxLength={10} />
      </Field>
      <Field label="New password">
        {/* Blank means "leave it alone". There is no way to show the current one —
            it is a bcrypt hash, which cannot be reversed. */}
        <input className={input} type="text" value={form.password} onChange={set("password")} placeholder="Leave blank to keep the current password" />
      </Field>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={disable}
          disabled={busy}
          className="rounded-lg border border-red-200 px-3 py-2 text-[12.5px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Disable
        </button>
      </div>
    </form>
  );
};

const EditModuleForm = ({ module: mod, onDone }) => {
  const [form, setForm] = useState({
    label: mod.label || "",
    group: mod.group || "",
    sortOrder: mod.sortOrder ?? 0,
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await updateCmsModule(mod.id, {
        label: form.label,
        group: form.group || null,
        sortOrder: Number(form.sortOrder) || 0,
      });
      ToastNotification.success("Module updated");
      onDone();
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || "Could not update module");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Route">
        {/* The key is what access is decided on, so it is not editable — changing
            it would silently detach every grant from the page it was meant for.
            A wrong key is deleted and re-added, deliberately. */}
        <input className={`${input} bg-gray-50 font-mono text-gray-500`} value={mod.key} disabled />
      </Field>
      <Field label="Label"><input className={input} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} required /></Field>
      <Field label="Group"><input className={input} value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))} placeholder="e.g. Lenders" /></Field>
      <Field label="Sort order"><input className={input} type="number" step="0.01" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} /></Field>
      <p className="text-[11px] text-gray-400">
        Renaming here sticks — the route sync never overwrites a label you have set.
      </p>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-purple-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
};

const NewModuleForm = ({ existing, onDone }) => {
  const unregistered = routeCatalogue().filter((m) => !existing.includes(m.key));
  const [form, setForm] = useState({ key: unregistered[0]?.key || "", label: "", group: "", sortOrder: 0 });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const picked = routeCatalogue().find((m) => m.key === form.key);
      await createCmsModule({
        key: form.key,
        label: form.label || picked?.label || form.key,
        group: form.group || picked?.group || null,
        sortOrder: Number(form.sortOrder) || picked?.sortOrder || 0,
      });
      ToastNotification.success("Module added");
      onDone();
    } catch (err) {
      ToastNotification.error(err?.response?.data?.message || "Could not add module");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Route">
        {/* A dropdown of the app's own routes, not a free-text box: a key that
            matches no route grants access to nothing, and the mistake is
            invisible until someone complains they cannot see a page. */}
        {unregistered.length ? (
          <select className={input} value={form.key} onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}>
            {unregistered.map((m) => (
              <option key={m.key} value={m.key}>{m.label} — {m.key}</option>
            ))}
          </select>
        ) : (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-[12px] text-gray-500">
            Every route in the app is already registered.
          </p>
        )}
      </Field>
      <Field label="Label (optional)">
        <input className={input} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Defaults to the route's own name" />
      </Field>
      <Field label="Group (optional)">
        <input className={input} value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))} placeholder="e.g. Lenders" />
      </Field>
      <button
        type="submit"
        disabled={busy || !unregistered.length}
        className="w-full rounded-lg bg-purple-600 px-3 py-2 text-[13px] font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
      >
        {busy ? "Adding…" : "Add module"}
      </button>
    </form>
  );
};
