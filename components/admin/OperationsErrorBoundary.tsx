"use client"

import type { ReactNode } from "react"
import { Component } from "react"

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  message: string
}

export class OperationsErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || "Unexpected Operations render error.",
    }
  }

  componentDidCatch(error: Error) {
    console.error("Operations render error:", error)
  }

  private handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload()
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main className="min-h-screen bg-[#eef3fb] px-4 py-6 text-[#152238]">
        <section className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-700">Operations recovery mode</div>
          <h1 className="mt-2 text-xl font-semibold text-rose-900">This screen hit a render error.</h1>
          <p className="mt-2 text-sm text-rose-900">
            Reload Operations to recover. If this keeps happening, report the issue and include what action you just took.
          </p>
          <div className="mt-3 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs text-rose-800">
            Error detail: {this.state.message}
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-4 rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-rose-800 hover:bg-rose-100"
          >
            Reload operations
          </button>
        </section>
      </main>
    )
  }
}

