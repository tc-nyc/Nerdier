import './ErrorBanner.css'

export interface ErrorBannerProps {
  /** The validator's reason, shown verbatim. Null hides the message. */
  readonly message: string | null
}

/**
 * Reserves its height at all times, so a rejected guess does not shove the
 * board down a line. `aria-live="polite"` announces the reason without
 * stealing focus from whatever the player was doing.
 */
export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="nd-banner" role="status" aria-live="polite" aria-atomic="true">
      {message !== null && message !== '' ? (
        <p className="nd-banner__message">{message}</p>
      ) : null}
    </div>
  )
}
