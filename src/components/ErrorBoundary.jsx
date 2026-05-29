import { Component } from 'react'

// Without this, any render error blanks the whole tree and you just see the
// dark body background — i.e. a "black screen". This surfaces the error instead.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('[Photobook] render error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fatal">
          <h2>Something broke while rendering the story</h2>
          <pre>{String(this.state.error?.stack || this.state.error)}</pre>
          <button className="cta-inline" onClick={() => this.props.onReset?.()}>
            Back to start
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
