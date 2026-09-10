'use client'
import axios from 'axios'
import { TokenService } from '../custom-hooks/index'

const pendingControllers = new Set()

export const cancelPendingRequests = (reason = 'route-change') => {
  pendingControllers.forEach((controller) => {
    try { controller.abort(reason) } catch (_) { /* noop */ }
  })
  pendingControllers.clear()
}

const createAxiosInstance = () => {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    timeout: 300000,
    params: {

    }
  })

  instance.defaults.headers.common['Content-Type'] = 'application/json'
  instance.defaults.headers.common['module-name'] = window && window.location.pathname

  const token = TokenService.getToken()
  if (token) {
    instance.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  instance.interceptors.response.use(
    function (response) {
      const controller = response.config && response.config.__abortController
      if (controller) pendingControllers.delete(controller)
      return response
    },
    function (error) {
      const controller = error.config && error.config.__abortController
      if (controller) pendingControllers.delete(controller)
      // 401 = the server rejected the session (missing, expired or tampered
      // token). Clear it and send the user back to login, otherwise every page
      // just renders empty and looks broken. 403 stays as it was.
      if (error.response && error.response.status === 401) {
        TokenService.removeToken()
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.replace('/login')
        }
      }
      if (error.response && error.response.status === 403) {
        TokenService.removeToken()
      }
      return Promise.reject(error)
    }
  )

  // Request interceptor
  instance.interceptors.request.use((config) => {
    const token = TokenService.getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    // Attach an AbortController so the request can be cancelled on route change.
    // Callers passing their own `signal` (or `skipAutoCancel: true`) opt out.
    if (!config.signal && !config.skipAutoCancel) {
      const controller = new AbortController()
      config.signal = controller.signal
      config.__abortController = controller
      pendingControllers.add(controller)
    }

    if (config.url !== '/auth/login' && !config.skipAdminAppend) {

      const [path, query] = config.url.split('?')

      // check if path has an ID at the end
      const parts = path.split('/')
     
      if (parts.length > 2 && /^\d+$/.test(parts[parts.length - 1])) {
        // id is last part => insert "admin" before it
        const id = parts.pop()
        const newPath = [...parts, 'admin', id].join('/')
        config.url = query ? `${newPath}?${query}` : newPath
      } else {
        // normal case => append admin at the end
        const newPath = `${path}/admin`
        config.url = query ? `${newPath}?${query}` : newPath
      }
    }

    return config
  })

  return instance
}

export default createAxiosInstance
