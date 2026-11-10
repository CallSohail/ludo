import { Component } from "react";
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="dash-recovery">
        <h1>The dashboard could not be displayed</h1>
        <p>
          Reload to try again. Your saved league scores are not changed by this
          error.
        </p>
        <button
          className="dash-button"
          onClick={() => window.location.reload()}
        >
          Reload dashboard
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
