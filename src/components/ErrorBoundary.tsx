"use client";

import React from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

function ErrorFallback({ moduleName, onReset }: { moduleName?: string; onReset: () => void }) {
  const { t } = useLanguage();
  const msg = moduleName
    ? t.common.moduleError.replace("{module}", moduleName)
    : t.common.unexpectedError;

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center p-8">
      <span className="material-symbols-outlined text-5xl text-[#ba1a1a]" aria-hidden="true">
        error_outline
      </span>
      <div>
        <p className="text-lg font-semibold text-[#1a1c1e]">{t.common.somethingWentWrong}</p>
        <p className="text-sm text-[#74777f] mt-1">{msg}</p>
      </div>
      <button className="btn-secondary text-sm" onClick={onReset}>
        {t.common.retry}
      </button>
    </div>
  );
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
        <ErrorFallback
          moduleName={this.props.moduleName}
          onReset={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }
    return this.props.children;
  }
}
