import firebaseConfig from '../../firebase-applet-config.json';

export interface RecaptchaAssessmentResult {
  valid: boolean;
  score?: number;
  reasons?: string[];
  action?: string;
  error?: string;
}

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || 'nexplayorg-app';
const SITE_KEY = process.env.VITE_RECAPTCHA_SITE_KEY || '6LfF2KAtAAAAAE90jzyt4N4-bQbpkC4Mj4mZ47bN';
const API_KEY = process.env.FIREBASE_API_KEY || firebaseConfig.apiKey;

/**
 * Verifies a reCAPTCHA Enterprise token with Google Cloud reCAPTCHA Enterprise REST API.
 * 
 * @param token The token received from the client-side grecaptcha execution.
 * @param expectedAction The user-initiated action string (e.g. 'login', 'register', 'submit').
 */
export async function createAssessment(
  token: string,
  expectedAction?: string
): Promise<RecaptchaAssessmentResult> {
  if (!token) {
    return { valid: false, error: 'Token is required' };
  }

  const endpoint = `https://recaptchaenterprise.googleapis.com/v1/projects/${PROJECT_ID}/assessments?key=${API_KEY}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event: {
          token,
          expectedAction: expectedAction || 'submit',
          siteKey: SITE_KEY,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        valid: false,
        error: `Assessment API failed with status ${response.status}: ${errorText}`,
      };
    }

    const data: any = await response.json();
    const tokenProperties = data.tokenProperties;
    const riskAnalysis = data.riskAnalysis;

    if (!tokenProperties?.valid) {
      return {
        valid: false,
        reasons: tokenProperties?.invalidReason ? [tokenProperties.invalidReason] : ['Token invalid'],
      };
    }

    return {
      valid: true,
      score: riskAnalysis?.score ?? 1.0,
      reasons: riskAnalysis?.reasons ?? [],
      action: tokenProperties?.action,
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error?.message || 'Failed to connect to reCAPTCHA assessment API',
    };
  }
}
