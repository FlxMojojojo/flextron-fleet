import { Component, type ReactNode } from 'react';

/**
 * Catches runtime errors from the Google Maps subtree (e.g. a bad key,
 * ApiNotActivatedMapError, or AdvancedMarker failures) and renders a fallback
 * instead — so a maps misconfiguration never takes down the dashboard.
 */
export class MapErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.warn('[map] Google Maps failed, falling back to OpenStreetMap:', error.message);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
