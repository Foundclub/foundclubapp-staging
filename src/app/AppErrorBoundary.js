import { Component } from 'react';

import ErrorScreen from '@/views/Error';

import { persistDiagnosticError } from '@/utils/bootDiagnostics';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    const { onError } = this.props;
    const payload = persistDiagnosticError(error, 'REACT_RENDER_ERROR', {
      isFatal: false,
      persistNonFatal: true,
    });

    console.error('[BOOT] REACT_RENDER_ERROR', {
      ...payload,
      componentStack: errorInfo?.componentStack || '',
    });

    try {
      onError?.(error, errorInfo);
    } catch (reportError) {
      console.warn('[BOOT] REACT_RENDER_ERROR_REPORT_FAILED', {
        message: reportError?.message || 'unknown',
      });
    }
  }

  render() {
    const { children, fallback } = this.props;
    const { error } = this.state;

    if (error) {
      return fallback || <ErrorScreen />;
    }

    return children;
  }
}

export default AppErrorBoundary;
