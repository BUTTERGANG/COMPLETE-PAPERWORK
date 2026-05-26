import { Component, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircleIcon } from './icons/Icons';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallback({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const navigate = useNavigate();
  const isDev = import.meta.env.DEV;

  return (
    <div className="flex items-center justify-center py-16 px-4">
      <div className="card-elevated text-center max-w-sm w-full animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-danger-dim flex items-center justify-center mx-auto mb-4">
          <AlertCircleIcon size={28} className="text-danger" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">
          Something went wrong
        </h2>
        {isDev && error && (
          <p className="text-sm text-text-tertiary mb-4 break-words">
            {error.message}
          </p>
        )}
        <div className="flex flex-col gap-3 mt-6">
          <button onClick={onReset} className="btn-primary">
            Try Again
          </button>
          <button onClick={() => navigate('/')} className="btn-secondary">
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}
