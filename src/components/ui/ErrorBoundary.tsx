import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: '16px',
          textAlign: 'center',
          padding: '32px',
          background: 'var(--color-bg-primary, #080d14)',
          color: 'var(--color-text-primary, #f0f4f8)',
          fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>⚾</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-tertiary, #4d6070)', maxWidth: 400 }}>
            The Dugout hit an unexpected error. Our dugout crew has been notified.
          </p>
          {this.state.error && (
            <pre style={{
              fontSize: 11,
              color: 'var(--color-text-muted, #3a4e60)',
              background: 'var(--color-bg-elevated, #1a2535)',
              padding: '12px 16px',
              borderRadius: 10,
              maxWidth: 480,
              overflowX: 'auto',
              textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleReset}
            style={{
              marginTop: 8,
              padding: '10px 24px',
              background: 'var(--color-accent, #20b2ff)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Back to Dashboard
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
