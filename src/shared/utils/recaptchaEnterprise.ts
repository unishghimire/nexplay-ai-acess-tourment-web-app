declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim();

/**
 * ponytail: the reCAPTCHA Enterprise script (~1.6MB with its locale module) is
 * injected on demand instead of globally in index.html, so pages that never
 * authenticate don't pay for it. The load promise is cached module-wide.
 */
let scriptPromise: Promise<void> | null = null;

function ensureRecaptchaScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.grecaptcha?.enterprise) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const onLoad = () => resolve();
    const onError = () => {
      scriptPromise = null; // allow retry on next call
      reject(new Error('reCAPTCHA Enterprise script failed to load'));
    };
    const existing = document.querySelector('script[data-recaptcha-enterprise]') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', onLoad, { once: true });
      existing.addEventListener('error', onError, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${SITE_KEY}`;
    script.async = true;
    script.dataset.recaptchaEnterprise = 'true';
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Executes Google reCAPTCHA Enterprise invisible token generation.
 *
 * @param action The user action identifier (e.g. 'LOGIN', 'REGISTER')
 * @returns A Promise resolving to the token string or null
 */
export async function executeRecaptchaEnterprise(action: string = 'SUBMIT'): Promise<string | null> {
  if (!SITE_KEY) return null;
  if (typeof window === 'undefined') return null;

  try {
    // Bounded wait: auth must never hang because a third-party script stalled.
    await Promise.race([
      ensureRecaptchaScript(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('reCAPTCHA script load timeout')), 10_000)),
    ]);
  } catch (err) {
    console.warn('reCAPTCHA Enterprise script unavailable:', err);
    return null;
  }

  return new Promise((resolve) => {
    try {
      window.grecaptcha!.enterprise!.ready(async () => {
        try {
          const token = await window.grecaptcha!.enterprise!.execute(SITE_KEY, { action });
          resolve(token);
        } catch (err) {
          console.warn('reCAPTCHA enterprise token execution warning:', err);
          resolve(null);
        }
      });
    } catch (err) {
      console.warn('reCAPTCHA enterprise ready callback error:', err);
      resolve(null);
    }
  });
}
