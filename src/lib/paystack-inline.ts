/**
 * Paystack Inline Modal & Pop Integration
 * Allows customers to pull up Paystack checkout directly within the web application.
 */

export function loadPaystackScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).PaystackPop) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.getElementById('paystack-inline-v2');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.id = 'paystack-inline-v2';
    script.src = 'https://js.paystack.co/v2/inline.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      // Fallback to v1 if v2 CDN fails
      const fallback = document.createElement('script');
      fallback.id = 'paystack-inline-v1';
      fallback.src = 'https://js.paystack.co/v1/inline.js';
      fallback.async = true;
      fallback.onload = () => resolve(true);
      fallback.onerror = () => resolve(false);
      document.body.appendChild(fallback);
    };
    document.body.appendChild(script);
  });
}

export interface PullPaystackOptions {
  accessCode?: string | null;
  authorizationUrl?: string | null;
  onSuccess?: (reference?: string) => void;
  onCancel?: () => void;
}

/**
 * Pulls up Paystack payment modal directly on screen.
 * If the inline pop library can resume with accessCode, it renders the modal overlay.
 * If inline is blocked or fails, it falls back to opening the authorization URL.
 */
export async function pullPaystackPayment(opts: PullPaystackOptions): Promise<{
  mode: 'popup' | 'redirect';
  opened: boolean;
}> {
  if (typeof window === 'undefined') return { mode: 'redirect', opened: false };

  const isLoaded = await loadPaystackScript();

  if (isLoaded && (window as any).PaystackPop && opts.accessCode) {
    try {
      const paystack = new (window as any).PaystackPop();
      if (typeof paystack.resumeTransaction === 'function') {
        paystack.resumeTransaction(opts.accessCode);
        return { mode: 'popup', opened: true };
      }
    } catch (err) {
      console.warn('PaystackPop inline execution error, falling back to authorization URL:', err);
    }
  }

  // Fallback to hosted authorization URL
  if (opts.authorizationUrl) {
    window.location.href = opts.authorizationUrl;
    return { mode: 'redirect', opened: true };
  }

  return { mode: 'redirect', opened: false };
}
