import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { buildApiUrl } from '../utils/apiUrl';
import { sanitizeErrorMessage } from '../utils/errorSanitizer';
import { trackRequest } from '../utils/requestTracker';

export const useApiRequest = () => {
  const { ensureValidToken, refreshToken, logout } = useAuth();
  const navigate = useNavigate();

  // A failed refresh used to mean "log the user out". It does not: refresh also
  // fails on a 429, on a backend restart, and while offline. AuthContext now
  // clears the session itself when (and only when) the token was truly
  // rejected, so here we just stop the request and leave the session alone
  // unless the token is already gone.
  const endSession = useCallback(() => {
    if (!localStorage.getItem('access-token')) {
      logout();
      navigate('/login');
      return new Error('Session expired. Please login again.');
    }
    return new Error('Could not reach the server. Please try again.');
  }, [logout, navigate]);

  const performRequest = useCallback(async (url, method = 'GET', body = null) => {
    // Ensure we have a valid (non-expired) token before making the request
    const isValid = await ensureValidToken();
    if (!isValid) {
      throw endSession();
    }

    const headers = {
      'Authorization': `Bearer ${localStorage.getItem('access-token') || ''}`,
    };

    // Only set Content-Type for requests that actually send a body
    if (body !== null) {
      headers['Content-Type'] = 'application/json';
    }

    const options = { method, headers, credentials: 'include' };
    if (body !== null) options.body = JSON.stringify(body);

    const requestUrl = buildApiUrl(url);
    const response = await fetch(requestUrl, options);

    // If we get a 401/419, try to refresh the token and retry once
    if (response.status === 401 || response.status === 419) {
      const refreshed = await refreshToken();
      if (!refreshed) {
        throw endSession();
      }

      const newToken = localStorage.getItem('access-token') || '';
      const retryResponse = await fetch(requestUrl, {
        ...options,
        headers: { ...headers, 'Authorization': `Bearer ${newToken}` },
        credentials: 'include',
      });
      
      const retryData = await retryResponse.json().catch(() => ({}));
      if (!retryResponse.ok) {
        throw new Error(sanitizeErrorMessage(retryData.message || 'Request failed'));
      }
      
      return retryData;
    }

    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      throw new Error(sanitizeErrorMessage(data.message || `Request failed (${response.status})`));
    }
    
    return data;
  }, [ensureValidToken, refreshToken, endSession]);

  // Registered with the request tracker so the dashboard's page loader can
  // wait for a newly opened page's data instead of revealing its empty state.
  const request = useCallback(
    (url, method = 'GET', body = null) => trackRequest(performRequest(url, method, body)),
    [performRequest],
  );

  const requestFormData = useCallback(async (url, method = 'POST', formData = null) => {
    const isValid = await ensureValidToken();
    if (!isValid) {
      throw endSession();
    }

    const buildOptions = () => ({
      method,
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('access-token') || ''}`,
      },
      credentials: 'include',
      body: formData,
    });

    const requestUrl = buildApiUrl(url);
    let response = await fetch(requestUrl, buildOptions());

    if (response.status === 401 || response.status === 419) {
      const refreshed = await refreshToken();
      if (!refreshed) {
        throw endSession();
      }
      response = await fetch(requestUrl, buildOptions());
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(sanitizeErrorMessage(data.message || `Request failed (${response.status})`));
    }
    return data;
  }, [ensureValidToken, refreshToken, endSession]);

  return { request, requestFormData };
};

export default useApiRequest;

// Hello hello 