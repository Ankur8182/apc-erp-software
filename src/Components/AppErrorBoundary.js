import React from "react";
import { ERP_NAME } from "../config/branding";
import { captureMonitoringError } from "../utils/monitoring";
import "../Styles/AppErrorBoundary.css";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // Keep diagnostics available to support staff without exposing error
    // details, stack traces, or Firebase internals in the user interface.
    console.error("Unhandled application render error:", error);
    void captureMonitoringError(error, {
      module: "app",
      operation: "application",
    });
  }

  handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-error-boundary" role="alert">
          <section className="app-error-boundary-card">
            <p className="app-error-boundary-brand">{ERP_NAME}</p>
            <h1>Something went wrong</h1>
            <p>Unable to load this screen. Please refresh and try again.</p>
            <button type="button" onClick={this.handleReload}>Refresh ERP</button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;