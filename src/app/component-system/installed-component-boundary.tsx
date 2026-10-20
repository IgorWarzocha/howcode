import { Component, type ReactNode } from 'react'
import { TextButton } from '../common/text-button'

/** A feature failure must not take the composer or peer component lifetimes with it. */
export class InstalledComponentBoundary extends Component<
  { name: string; children: ReactNode },
  { error: string | null }
> {
  override state: { error: string | null } = { error: null }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
  override componentDidCatch(error: Error) {
    console.error(`Component rendering failed: ${this.props.name}`, error)
  }
  override render() {
    return this.state.error === null ? (
      this.props.children
    ) : (
      <div>
        <p role="alert">
          {this.props.name}: {this.state.error}
        </p>
        <TextButton onClick={() => this.setState({ error: null })}>Retry</TextButton>
      </div>
    )
  }
}
