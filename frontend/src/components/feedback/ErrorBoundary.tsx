import { Component, type ErrorInfo, type PropsWithChildren, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Application error boundary caught an error", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-slate-50 px-4 dark:bg-slate-950">
          <div className="max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-sm dark:border-red-900/60 dark:bg-slate-900">
            <AlertTriangle className="mb-4 h-8 w-8 text-red-600" aria-hidden="true" />
            <h1 className="text-lg font-semibold text-slate-950 dark:text-white">Something went wrong</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              The application shell hit an unexpected error. Refresh the page or try again after a moment.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
