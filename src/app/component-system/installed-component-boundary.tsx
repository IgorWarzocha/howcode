import { Component, type ReactNode } from 'react'

/** A feature failure must not take the composer or peer component lifetimes with it. */
export class InstalledComponentBoundary extends Component<
  { name: string; children: ReactNode; onError: (error: string) => void },
  { error: string | null }
> {
  override state: { error: string | null } = { error: null }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  override componentDidCatch(error: Error) {
    this.props.onError(error.message)
  }
  override render() {
    return this.state.error ? (
      <p role="alert">
        {this.props.name}: {this.state.error}
      </p>
    ) : (
      this.props.children
    )
  }
}
