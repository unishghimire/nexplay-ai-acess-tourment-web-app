/**
 * Centralized Error Handler Utility
 * Logs errors cleanly in development and triggers user notifications safely.
 */

export interface ErrorHandlerOptions {
  context?: string;
  showToast?: (message: string, type: 'error' | 'warning' | 'info' | 'success') => void;
  userMessage?: string;
  silent?: boolean;
}

export function logAndToastError(error: any, options: ErrorHandlerOptions = {}) {
  const { context = 'Operation', showToast, userMessage, silent = false } = options;

  const errorMessage = error?.message || (typeof error === 'string' ? error : 'An unexpected error occurred');
  
  if (!silent) {
    console.error(`[${context} Error]:`, error);
  }

  if (showToast) {
    const displayMsg = userMessage || `${context} failed: ${errorMessage}`;
    showToast(displayMsg, 'error');
  }

  return errorMessage;
}
