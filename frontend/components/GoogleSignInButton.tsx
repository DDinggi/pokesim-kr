'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentityApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    nonce: string;
    ux_mode: 'popup';
    auto_select: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type: 'standard';
      theme: 'outline';
      size: 'large';
      text: 'continue_with';
      shape: 'rectangular';
      logo_alignment: 'left';
      locale: 'ko';
      width: number;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityApi;
      };
    };
  }
}

export interface GoogleSignInButtonProps {
  disabled?: boolean;
  onCredential: (idToken: string, nonce: string) => Promise<void>;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = bytesToHex(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return { raw, hashed: bytesToHex(new Uint8Array(digest)) };
}

export function GoogleSignInButton({ disabled = false, onCredential }: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const renderAttemptRef = useRef(0);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  const renderGoogleButton = useCallback(async () => {
    const googleIdentity = window.google?.accounts.id;
    const parent = buttonRef.current;
    if (!clientId || !googleIdentity || !parent) return;

    const attempt = ++renderAttemptRef.current;
    try {
      const nonce = await createNonce();
      if (attempt !== renderAttemptRef.current || !buttonRef.current) return;

      googleIdentity.initialize({
        client_id: clientId,
        nonce: nonce.hashed,
        ux_mode: 'popup',
        auto_select: false,
        callback: (response) => {
          if (!response.credential) {
            setError('Google 로그인 정보를 받지 못했습니다. 다시 시도해주세요.');
            return;
          }
          setError(null);
          void callbackRef.current(response.credential, nonce.raw);
        },
      });

      parent.replaceChildren();
      googleIdentity.renderButton(parent, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        locale: 'ko',
        width: 220,
      });
      setError(null);
    } catch {
      setError('Google 로그인 버튼을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  }, [clientId]);

  const handleScriptReady = useCallback(() => {
    setScriptReady(true);
    void renderGoogleButton();
  }, [renderGoogleButton]);

  return (
    <div>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={handleScriptReady}
        onError={() => setError('Google 로그인 버튼을 불러오지 못했습니다.')}
      />
      <div
        ref={buttonRef}
        className={`h-10 w-[220px] overflow-hidden rounded ${disabled ? 'pointer-events-none opacity-60' : ''}`}
        aria-busy={!scriptReady || disabled}
      />
      {!clientId ? (
        <p className="mt-1 text-[11px] text-red-300">Google 로그인 설정을 확인해주세요.</p>
      ) : error ? (
        <p className="mt-1 text-[11px] text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
