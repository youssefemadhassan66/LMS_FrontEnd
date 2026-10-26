import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { buildApiUrl } from '../utils/apiUrl';
import { sanitizeErrorMessage } from '../utils/errorSanitizer';
import { beginRequest } from '../utils/requestTracker';

const useFetchData = (endpoint, options = {}) => {
  const { ensureValidToken, refreshToken } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  
  const { skip = false } = options;

  const fetchData = useCallback(async (retry = false) => {
    if (skip || !endpoint) {
      setLoading(false);
      return;
    }

    if (retry) {
      retryCountRef.current++;
      if (retryCountRef.current > 1) {
        setError('Failed to fetch data. Please try again.');
        setLoading(false);
        return;
      }
    }

    // Registered before the token check, which can itself hit the network.
    const endRequest = beginRequest();
    try {
      setLoading(true);
      setError(null);
      
      // ensureValidToken now actually checks JWT expiry and refreshes if needed
      const isValid = await ensureValidToken();
      if (!isValid) {
        setError('Please login to continue.');
        setLoading(false);
        return;
      }

      const currentToken = localStorage.getItem('access-token') || '';
      
      const response = await fetch(buildApiUrl(endpoint), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        credentials: 'include',
      });

      if (response.status === 401 || response.status === 419) {
        const refreshed = await refreshToken();
        if (!refreshed) {
          setError('Session expired. Please login again.');
          setLoading(false);
          return;
        }

        await fetchData(true);
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(sanitizeErrorMessage(result.message || 'Failed to fetch data'));
      }

      retryCountRef.current = 0;
      
      if (isMountedRef.current) {
        setData(result?.data ?? result);
        setError(null);
      }
    } catch (err) {
      if (isMountedRef.current) {
        if (err.name === 'SyntaxError') {
          setError('Invalid response from server');
        } else {
          setError(sanitizeErrorMessage(err.message));
        }
      }
    } finally {
      endRequest();
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [endpoint, skip, ensureValidToken, refreshToken]);

  useEffect(() => {
    isMountedRef.current = true;
    retryCountRef.current = 0;
    fetchData();

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  const refetch = useCallback(() => {
    retryCountRef.current = 0;
    return fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

export default useFetchData;
