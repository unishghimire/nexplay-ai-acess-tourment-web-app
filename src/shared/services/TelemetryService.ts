// FILE_ID: services/TelemetryService.ts
// MODULE: Telemetry & Monitoring
// PURPOSE: Global telemetry engine mapping user logs, event tracking, funnels, performance logs, and error interception.
// DEPENDENCIES: None (Vanilla JS/TS with standard Browser APIs)

export interface TelemetryEvent {
  id: string;
  category: 'User' | 'Interaction' | 'Funnel' | 'Performance' | 'Error';
  action: string;
  label?: string;
  timestamp: string;
  value?: number;
  metadata?: Record<string, any>;
}

class TelemetryService {
  private static instance: TelemetryService;
  private logsBuffer: TelemetryEvent[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

  private constructor() {
    this.loadFromStorage();
    this.setupGlobalInterceptors();
  }

  public static getInstance(): TelemetryService {
    if (!TelemetryService.instance) {
      TelemetryService.instance = new TelemetryService();
    }
    return TelemetryService.instance;
  }

  private loadFromStorage() {
    try {
      const stored = sessionStorage.getItem('nexplay_telemetry_logs');
      if (stored) {
        this.logsBuffer = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('[TELEMETRY] Failed to read cached logs:', e);
    }
  }

  private persist() {
    try {
      sessionStorage.setItem('nexplay_telemetry_logs', JSON.stringify(this.logsBuffer));
    } catch (e) {
      console.warn('[TELEMETRY] Failed to write cached logs:', e);
    }
  }

  private setupGlobalInterceptors() {
    if (typeof window === 'undefined') return;

    // Monitor Uncaught Errors
    window.addEventListener('error', (event) => {
      this.trackError('UncaughtException', event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Monitor Unhandled Promise Rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
      this.trackError('UnhandledRejection', reason, {
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
      });
    });

    // Monitor custom Firestore or App errors
    window.addEventListener('app-error', (event: any) => {
      if (event.detail) {
        this.trackError('AppCustomError', event.detail.error || 'Firestore Operation failed', event.detail);
      }
    });
  }

  public track(category: TelemetryEvent['category'], action: string, label?: string, value?: number, metadata?: Record<string, any>) {
    const event: TelemetryEvent = {
      id: `tel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category,
      action,
      label,
      timestamp: new Date().toISOString(),
      value,
      metadata
    };

    this.logsBuffer.unshift(event);
    if (this.logsBuffer.length > this.MAX_BUFFER_SIZE) {
      this.logsBuffer.pop();
    }

    this.persist();

    // Only log in development to avoid console noise in production
    if (import.meta.env.DEV) {
      const categoryColors: Record<string, string> = {
        User: 'background: #3b82f6; color: #fff',
        Interaction: 'background: #10b981; color: #fff',
        Funnel: 'background: #8b5cf6; color: #fff',
        Performance: 'background: #f59e0b; color: #fff',
        Error: 'background: #ef4444; color: #fff'
      };
      console.log(
        `%c[TELEMETRY][${category}]%c ${action} | Label: ${label || 'N/A'}`,
        categoryColors[category] || 'background: #6b7280; color: #fff',
        'color: #9ca3af'
      );
    }
  }

  public trackUser(action: string, email?: string, metadata?: Record<string, any>) {
    this.track('User', action, email, undefined, metadata);
  }

  public trackInteraction(action: string, componentName: string, metadata?: Record<string, any>) {
    this.track('Interaction', action, componentName, undefined, metadata);
  }

  public trackFunnel(stage: string, funnelName: string, success: boolean, metadata?: Record<string, any>) {
    this.track('Funnel', stage, funnelName, success ? 1 : 0, metadata);
  }

  public trackPerformance(actionName: string, durationMs: number, metadata?: Record<string, any>) {
    this.track('Performance', actionName, `${durationMs.toFixed(1)}ms`, durationMs, metadata);
  }

  public trackError(type: string, message: string, metadata?: Record<string, any>) {
    this.track('Error', type, message, undefined, metadata);
  }

  public getLogs(): TelemetryEvent[] {
    return [...this.logsBuffer];
  }

  public clearLogs() {
    this.logsBuffer = [];
    this.persist();
  }
}

export const telemetry = TelemetryService.getInstance();
