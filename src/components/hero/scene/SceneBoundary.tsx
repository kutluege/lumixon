"use client";

import { Component, type ReactNode } from "react";

/** If the WebGL scene throws (context creation, shader compile), render nothing: the poster stays. */
export class SceneBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
