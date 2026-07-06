const TOKEN_KEY = 'access_token'
const USER_DATA_KEY = 'USER_DATA'
const LOGIN_TIME_KEY = 'LOGIN_TIME'
const SESSION_DURATION = 8 * 60 * 60 * 1000 // 8 hours in ms
const ISSERVER = typeof window === 'undefined'

const TokenService = {
    getToken: () => {
        if (!ISSERVER) {
            const loginTime = localStorage.getItem(LOGIN_TIME_KEY)
            if (loginTime && Date.now() - Number(loginTime) > SESSION_DURATION) {
                // 24 hours expired — clear everything
                localStorage.removeItem(TOKEN_KEY)
                localStorage.removeItem(USER_DATA_KEY)
                localStorage.removeItem(LOGIN_TIME_KEY)
                return ''
            }
            return localStorage.getItem(TOKEN_KEY) || ''
        }
        return null
    },

    saveToken: (accessToken) => {
        if (!ISSERVER) {
            localStorage.setItem(TOKEN_KEY, accessToken)
            localStorage.setItem(LOGIN_TIME_KEY, String(Date.now()))
        }
    },

    removeToken: () => {
        if (!ISSERVER) {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(LOGIN_TIME_KEY)
        }
    },

    getLoginTime: () => {
        if (!ISSERVER) {
            return Number(localStorage.getItem(LOGIN_TIME_KEY)) || 0
        }
        return 0
    },

    getRemainingTime: () => {
        if (!ISSERVER) {
            const loginTime = Number(localStorage.getItem(LOGIN_TIME_KEY)) || 0
            if (!loginTime) return 0
            const remaining = SESSION_DURATION - (Date.now() - loginTime)
            return remaining > 0 ? remaining : 0
        }
        return 0
    },

    clearStorageData: () => {
        if (!ISSERVER) {
            localStorage.clear()
        }
    }
}

const UserService = {
    getUser: () => {
        if (!ISSERVER) {
            return JSON.parse(localStorage.getItem(USER_DATA_KEY)) || null
        }
        return null
    },

    saveUser(user_data) {
        if (!ISSERVER) {
            localStorage.setItem(USER_DATA_KEY, JSON.stringify(user_data))
        }
    },

    removeUser() {
        if (!ISSERVER) {
            localStorage.removeItem(USER_DATA_KEY)
        }
    }
}

export { TokenService, UserService }
