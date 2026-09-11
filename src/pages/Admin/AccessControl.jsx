import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Boxes,
  Search,
  Plus,
  RefreshCw,
  Check,
  X,
  Power,
  Trash2,
  Pencil,
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

const input =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-[13px] outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100";

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
    <div className="max-w-[1440px] mx-auto px-2 py-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-purple-100 text-purple-600">
            <Boxes size={18} />
          </span>
          <div>
            <h1 className="text-[18px] font-bold leading-tight text-gray-900">Access Control</h1>
            <p className="text-[12px] text-gray-500">Users, modules, and who can open what.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-4 inline-flex rounded-xl bg-gray-100 p-1">
        {[
          { k: "users", label: "Users", Icon: UsersIcon, n: users.length },
          { k: "modules", label: "Modules", Icon: Boxes, n: modules.length },
        ].map(({ k, label, Icon, n }) => (
          <button
            key={k}
            type="button"
            onClick={() => { setTab(k); setSelected(null); }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              tab === k ? "bg-white text-purple-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon size={14} /> {label}
            <span className="ml-0.5 rounded-full bg-gray-200 px-1.5 text-[10px] font-bold tabular-nums text-gray-600">{n}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-[13px] text-gray-400">Loading…</div>
      ) : tab === "users" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* Users list */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 p-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, email or role…"
                  className={`${input} pl-8`}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowNewUser(true)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-2 text-[12px] font-semibold text-white hover:bg-purple-700"
              >
                <Plus size={14} /> User
              </button>
            </div>

            <div className="max-h-[560px] divide-y divide-gray-50 overflow-y-auto">
              {shownUsers.map((u) => (
                <button
                  key={u.email}
                  type="button"
                  onClick={() => openUser(u)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition hover:bg-purple-50/60 ${
                    selected === u.email ? "bg-purple-50" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-gray-800">{u.name}</div>
                    <div className="truncate text-[11px] text-gray-500">{u.email}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{u.role}</span>
                    {/* The distinction the whole page rests on. */}
                    {u.usesRoleDefaults ? (
                      <span className="rounded-full bg-gray-50 px-2 py-0.5 text-[10px] text-gray-400" title="No modules assigned — this user follows their role's defaults">
                        role default
                      </span>
                    ) : (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 tabular-nums">
                        {u.modules.length} module{u.modules.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {!shownUsers.length && (
                <div className="p-6 text-center text-[12.5px] text-gray-400">No users match that search.</div>
              )}
            </div>
          </div>

          {/* Module assignment for the selected user */}
          <div className="rounded-xl border border-gray-200 bg-white">
            {!editing ? (
              <div className="p-8 text-center text-[13px] text-gray-400">
                Pick a user to set their modules.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-gray-800">{editing.name}</div>
                    <div className="truncate text-[11px] text-gray-500">{editing.email} · {editing.role}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditUser(editing)}
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11.5px] font-medium text-gray-600 hover:bg-gray-50"
                      title="Edit name, role, phone, password or disable this user"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft([])}
                      className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11.5px] font-medium text-gray-600 hover:bg-gray-50"
                      title="Clear every module so this user follows their role's defaults again"
                    >
                      Role default
                    </button>
                    <button
                      type="button"
                      onClick={saveModules}
                      disabled={saving}
                      className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
                    >
                      <Check size={13} /> {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>

                <p className="border-b border-gray-100 bg-amber-50/60 px-3 py-2 text-[11.5px] text-amber-800">
                  {draft.length === 0
                    ? "Nothing ticked — this user follows their role's defaults."
                    : `${draft.length} module(s) ticked. This replaces their role's defaults entirely.`}
                </p>

                <div className="max-h-[480px] overflow-y-auto p-3">
                  {grouped.map(([group, list]) => (
                    <div key={group} className="mb-3">
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400">{group}</div>
                      <div className="grid gap-1 sm:grid-cols-2">
                        {list.map((m) => (
                          <label
                            key={m.key}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] transition ${
                              draft.includes(m.key)
                                ? "border-purple-200 bg-purple-50 text-purple-800"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                            } ${m.isActive ? "" : "opacity-50"}`}
                          >
                            <input
                              type="checkbox"
                              checked={draft.includes(m.key)}
                              onChange={() => toggle(m.key)}
                              className="h-3.5 w-3.5 accent-purple-600"
                            />
                            <span className="truncate">{m.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Modules tab */
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-3">
            <span className="text-[12.5px] text-gray-500">
              Registered from the app's own routes. A row here does not create a page — the page must exist in code.
            </span>
            <button
              type="button"
              onClick={() => setShowNewModule(true)}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-purple-600 px-2.5 py-2 text-[12px] font-semibold text-white hover:bg-purple-700"
            >
              <Plus size={14} /> Module
            </button>
          </div>

          <div className="max-h-[620px] overflow-y-auto">
            {grouped.map(([group, list]) => (
              <div key={group}>
                <div className="sticky top-0 bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                  {group}
                </div>
                {list.map((m) => (
                  <div key={m.id} className={`flex items-center justify-between gap-3 border-b border-gray-50 px-3 py-2 ${m.isActive ? "" : "bg-gray-50/60"}`}>
                    <div className="min-w-0">
                      <div className={`truncate text-[13px] font-medium ${m.isActive ? "text-gray-800" : "text-gray-400 line-through"}`}>{m.label}</div>
                      <div className="truncate font-mono text-[11px] text-gray-400">{m.key}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditModule(m)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
                        title="Rename, regroup or reorder"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await updateCmsModule(m.id, { isActive: !m.isActive });
                          load();
                        }}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
                        title={m.isActive ? "Switch off for everyone" : "Switch back on"}
                      >
                        <Power size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          // Deleting drops every grant with it, so it asks first —
                          // switching off keeps the history of who had access.
                          if (!window.confirm(`Delete "${m.label}"? Everyone's access to it is removed too.`)) return;
                          await deleteCmsModule(m.id);
                          load();
                        }}
                        className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
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
