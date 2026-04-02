import { Component, ErrorInfo, ReactNode } from "react";
import i18n from "@/i18n";

interface Props {
  children: ReactNode;
  /** Custom fallback UI to render when an error is caught */
  fallback?: ReactNode;
  /** Space identifier for scoped boundaries (CRM, King, Client) */
  space?: string;
  /** Callback fired when an error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const label = this.props.space ? `:${this.props.space}` : "";
    console.error(
      `[ErrorBoundary${label}] Uncaught error:`,
      error,
      errorInfo
    );

    this.props.onError?.(error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const t = (key: string, options?: Record<string, string>) =>
      i18n.t(key, options);

    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 py-12 text-center">
        {/* Icon */}
        <div className="flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-destructive/10">
          <svg
            className="w-8 h-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {t("errorBoundary.title")}
        </h2>

        {/* Description */}
        <p className="text-muted-foreground mb-1 max-w-md">
          {t("errorBoundary.description")}
        </p>

        {/* Space info */}
        {this.props.space && (
          <p className="text-sm text-muted-foreground/70 mb-6">
            {t("errorBoundary.spaceInfo", { space: this.props.space })}
          </p>
        )}

        {!this.props.space && <div className="mb-6" />}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
              />
            </svg>
            {t("errorBoundary.reload")}
          </button>

          <button
            onClick={this.handleGoHome}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background"
          >
            {t("errorBoundary.goHome")}
          </button>
        </div>

        {/* Dev error details */}
        {import.meta.env.DEV && this.state.error && (
          <details className="mt-8 w-full max-w-2xl text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("errorBoundary.devDetails")}
            </summary>
            <pre className="mt-2 p-4 bg-muted rounded-lg text-xs text-foreground/80 overflow-auto max-h-64 border border-border">
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </pre>
          </details>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
