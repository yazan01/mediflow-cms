"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.moduleName ?? ""}:`, error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center p-8">
          <span className="material-symbols-outlined text-5xl text-[#ba1a1a]">
            error_outline
          </span>
          <div>
            <p className="text-lg font-semibold text-[#1a1c1e]">
              Something went wrong
            </p>
            <p className="text-sm text-[#74777f] mt-1">
              {this.props.moduleName
                ? `The ${this.props.moduleName} module encountered an error.`
                : "An unexpected error occurred."}
            </p>
          </div>
          <button
            className="btn-secondary text-sm"
            onClick={() => this.setState({ hasError: false, error: undefined })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
