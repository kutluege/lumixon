"use client";

import { Component, type ReactNode } from "react";

/** A flank scene that throws (context creation, shader compile, chunk load) renders nothing: the fallback stays. */
export class FlankBoundary extends Component<{ children: ReactNode; onError?: () => void }, { failed: boolean }> {
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
