'use client';

import { useEffect, useState, createContext, useContext, ReactNode } from 'react';

interface GoogleOAuthContextType {
  isInitialized: boolean;
  clientId: string;
}

const GoogleOAuthContext = createContext<GoogleOAuthContextType>({
  isInitialized: false,
  clientId: '',
});

export function useGoogleOAuth() {
  return useContext(GoogleOAuthContext);
}

interface GoogleOAuthProviderProps {
  children: ReactNode;
}

export function GoogleOAuthProvider({ children }: GoogleOAuthProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    if (!clientId || clientId === 'your-google-client-id.apps.googleusercontent.com') {
      console.warn('Google Client ID not configured. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local');
      return;
    }

    if (typeof window === 'undefined') return;

    const loadGoogleScript = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            console.log('Google ID token received');
          },
          auto_select: false,
          cancel_on_tap_outside: false,
        });
        setIsInitialized(true);
      }
    };

    if (window.google?.accounts?.id) {
      loadGoogleScript();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = loadGoogleScript;
      document.head.appendChild(script);
    }
  }, [clientId]);

  return (
    <GoogleOAuthContext.Provider value={{ isInitialized, clientId }}>
      {children}
    </GoogleOAuthContext.Provider>
  );
}
