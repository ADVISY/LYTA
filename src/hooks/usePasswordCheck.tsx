import { useState, useCallback } from 'react';

interface PasswordCheckResult {
  isCompromised: boolean;
  count: number;
}

/**
 * Hook to check if a password has been exposed in known data breaches
 * Uses the HaveIBeenPwned API with k-anonymity (only first 5 chars of SHA-1 hash are sent)
 */
export function usePasswordCheck() {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Converts a string to SHA-1 hash
   */
  const sha1 = async (str: string): Promise<string> => {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  /**
   * Check if a password has been compromised using HaveIBeenPwned API
   * Returns { isCompromised: boolean, count: number }
   */
  const checkPassword = useCallback(async (password: string): Promise<PasswordCheckResult> => {
    if (!password || password.length < 1) {
      return { isCompromised: false, count: 0 };
    }

    setChecking(true);
    setError(null);

    try {
      // Hash the password with SHA-1
      const hash = await sha1(password);
      
      // Use k-anonymity: send only first 5 characters
      const prefix = hash.slice(0, 5);
      const suffix = hash.slice(5);

      // Query the HaveIBeenPwned API
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: {
          'Add-Padding': 'true', // Adds padding to prevent response size analysis
        },
      });

      if (!response.ok) {
        // Don't block signup if API is unavailable
        console.warn('HaveIBeenPwned API unavailable:', response.status);
        return { isCompromised: false, count: 0 };
      }

      const text = await response.text();
      
      // Parse the response - each line is "SUFFIX:COUNT"
      const lines = text.split('\n');
      for (const line of lines) {
        const [hashSuffix, countStr] = line.split(':');
        if (hashSuffix?.trim().toUpperCase() === suffix) {
          const count = parseInt(countStr?.trim() || '0', 10);
          return { isCompromised: count > 0, count };
        }
      }

      return { isCompromised: false, count: 0 };
    } catch (err) {
      // Don't block signup if there's an error
      console.error('Error checking password:', err);
      setError('Impossible de vérifier le mot de passe');
      return { isCompromised: false, count: 0 };
    } finally {
      setChecking(false);
    }
  }, []);

  return {
    checkPassword,
    checking,
    error,
  };
}
