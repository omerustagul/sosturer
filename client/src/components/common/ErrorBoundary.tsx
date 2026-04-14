import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-theme/50 flex flex-col items-center justify-center p-2 text-center">
          <div className="modern-glass-card max-w-md w-full p-8 rounded-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>

            <h1 className="text-xl font-semibold mb-2">Beklenmeyen Bir Hata Oluştu</h1>
            <p className="text-sm text-muted-foreground mb-4">
              Arayüz yüklenirken teknik bir sorunla karşılaştık. Lütfen sayfayı yenilemeyi deneyin.
            </p>

            {this.state.error && (
              <div className="w-full text-left bg-muted/30 p-4 rounded-lg mb-6 overflow-hidden">
                <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-4 w-full">
              <button
                onClick={this.handleGoHome}
                className="flex-1 btn-next-gen p-3 h-10 rounded-xl flex items-center justify-center gap-2 bg-purple-500/10 text-purple-500 hover:scale-105"
              >
                <Home className="w-4 h-4" />
                <span>Ana Sayfa</span>
              </button>

              <button
                onClick={this.handleReload}
                className="flex-1 btn-next-gen p-3 h-10 rounded-xl flex items-center justify-center gap-2 bg-theme-primary/10 text-theme-primary hover:scale-105"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Yenile</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
