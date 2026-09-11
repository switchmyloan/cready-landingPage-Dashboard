import Api from '../api';

// Dev-only administration: who exists, what modules exist, and who can open what.
// Every one of these is refused with 403 for any other role — the server checks
// the role inside the token, so hiding the screen is not what protects them.

const opts = { skipAdminAppend: true };

export const getCmsUsers = () => Api().get('/admin/cms-users', opts);

export const createCmsUser = (payload) => Api().post('/admin/cms-users', payload, opts);

export const updateCmsUser = (email, patch) =>
  Api().put(`/admin/cms-users/${encodeURIComponent(email)}`, patch, opts);

// Replace a user's module grants. An EMPTY array is meaningful: it clears every
// grant and hands them back to their role's defaults.
export const setCmsUserModules = (email, modules) =>
  Api().put(`/admin/cms-users/${encodeURIComponent(email)}/modules`, { modules }, opts);

export const getCmsModules = (includeInactive = false) =>
  Api().get(`/admin/cms-modules${includeInactive ? '?includeInactive=1' : ''}`, opts);

export const createCmsModule = (payload) => Api().post('/admin/cms-modules', payload, opts);

export const updateCmsModule = (id, patch) => Api().put(`/admin/cms-modules/${id}`, patch, opts);

export const deleteCmsModule = (id) => Api().delete(`/admin/cms-modules/${id}`, opts);

// Registers the app's own routes so a page added in code shows up here without
// anyone maintaining a second list by hand.
export const syncCmsModules = (modules) =>
  Api().post('/admin/cms-modules/sync', { modules }, opts);
