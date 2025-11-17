/**
 * Authentication Token Management Service
 * Handles JWT tokens, session management, and user authentication
 */

// Token storage keys
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_KEY = 'token_expiry';
const USER_KEY = 'user';

// Default token expiry (1 hour in seconds)
const DEFAULT_TOKEN_EXPIRY = parseInt(
  process.env.NEXT_PUBLIC_TOKEN_EXPIRY || '3600',
  10
);

/**
 * Check if code is running in browser
 */
const isBrowser = () => typeof window !== 'undefined';

/**
 * Authentication Service
 */
export const authService = {
  /**
   * Set authentication tokens after successful login
   * @param {Object} data - {access_token, refresh_token}
   */
  setTokens(data) {
    if (!isBrowser()) return;

    const { access_token, refresh_token } = data;

    if (access_token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, access_token);

      // Calculate and store token expiry time
      const expiryTime = Date.now() + DEFAULT_TOKEN_EXPIRY * 1000;
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    }

    if (refresh_token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    }
  },

  /**
   * Get access token from storage
   * @returns {string|null}
   */
  getAccessToken() {
    if (!isBrowser()) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  /**
   * Get refresh token from storage
   * @returns {string|null}
   */
  getRefreshToken() {
    if (!isBrowser()) return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Check if user is authenticated
   * @returns {boolean}
   */
  isAuthenticated() {
    if (!isBrowser()) return false;

    const token = this.getAccessToken();
    if (!token) return false;

    // Check if token is expired
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (expiry && Date.now() > parseInt(expiry, 10)) {
      // Token expired, try to refresh
      return false;
    }

    return true;
  },

  /**
   * Check if token is about to expire (within 5 minutes)
   * @returns {boolean}
   */
  isTokenExpiringSoon() {
    if (!isBrowser()) return false;

    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return false;

    const expiryTime = parseInt(expiry, 10);
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

    return Date.now() + fiveMinutes > expiryTime;
  },

  /**
   * Refresh access token using refresh token
   * @returns {Promise<string|null>} New access token or null if refresh failed
   */
  async refreshToken() {
    if (!isBrowser()) return null;

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearTokens();
      return null;
    }

    try {
      // Import authAPI here to avoid circular dependency
      const { authAPI } = await import('./api');
      const data = await authAPI.refresh(refreshToken);

      // Update tokens
      this.setTokens({
        access_token: data.access_token,
        refresh_token: refreshToken, // Keep the same refresh token
      });

      return data.access_token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return null;
    }
  },

  /**
   * Clear all authentication tokens and user data
   */
  clearTokens() {
    if (!isBrowser()) return;

    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * Logout user and redirect to login page
   */
  logout() {
    this.clearTokens();
    if (isBrowser()) {
      window.location.href = '/login';
    }
  },

  /**
   * Set user profile data
   * @param {Object} user - User profile data
   */
  setUser(user) {
    if (!isBrowser()) return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  /**
   * Get user profile data from storage
   * @returns {Object|null}
   */
  getUser() {
    if (!isBrowser()) return null;

    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;

    try {
      return JSON.parse(userStr);
    } catch (error) {
      console.error('Failed to parse user data:', error);
      return null;
    }
  },

  /**
   * Get username from token or user data
   * @returns {string|null}
   */
  getUsername() {
    const user = this.getUser();
    return user?.username || null;
  },

  /**
   * Initialize automatic token refresh
   * Checks every minute if token needs refreshing
   */
  initializeAutoRefresh() {
    if (!isBrowser()) return;

    // Clear any existing interval
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }

    // Check every minute
    this._refreshInterval = setInterval(async () => {
      if (this.isAuthenticated() && this.isTokenExpiringSoon()) {
        console.log('Token expiring soon, refreshing...');
        await this.refreshToken();
      }
    }, 60 * 1000); // Check every minute
  },

  /**
   * Stop automatic token refresh
   */
  stopAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
  },

  /**
   * Decode JWT token (simple base64 decode, doesn't verify signature)
   * @param {string} token
   * @returns {Object|null}
   */
  decodeToken(token) {
    if (!token) return null;

    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );

      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  },

  /**
   * Get token expiry date
   * @returns {Date|null}
   */
  getTokenExpiryDate() {
    if (!isBrowser()) return null;

    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return null;

    return new Date(parseInt(expiry, 10));
  },

  /**
   * Get time until token expires (in milliseconds)
   * @returns {number} Time in milliseconds, or 0 if expired
   */
  getTimeUntilExpiry() {
    const expiryDate = this.getTokenExpiryDate();
    if (!expiryDate) return 0;

    const timeRemaining = expiryDate.getTime() - Date.now();
    return Math.max(0, timeRemaining);
  },
};

export default authService;
