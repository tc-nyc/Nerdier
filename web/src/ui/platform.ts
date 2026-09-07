/**
 * The one place in the app that sniffs the user agent.
 *
 * User-agent sniffing is unreliable, so its blast radius is kept to a single
 * cosmetic decision: which words the `nerdiest` win celebration shows. Nothing
 * here may ever gate game logic, validation or scoring.
 *
 * Two functions on purpose:
 * - {@link isIPhoneUserAgent} is pure — hand it a string, get a boolean. Tests
 *   and previews use this one.
 * - {@link isIPhoneDevice} reads the ambient `navigator`, and answers `false`
 *   when there isn't one. The game logic tests run in plain node, where
 *   `navigator.userAgent` may be absent entirely; this must not throw there.
 *
 * iPadOS deliberately reports itself as a Mac, so an iPad reads as "not an
 * iPhone" and sees the normal wording. That is accepted, not overlooked.
 */

/** iPod touch runs the same phone-shaped Safari, so it counts. iPad does not. */
const IPHONE_UA = /iphone|ipod/i

/** Pure form: does this user-agent string look like an iPhone or iPod touch? */
export function isIPhoneUserAgent(userAgent: string): boolean {
  return IPHONE_UA.test(userAgent)
}

/**
 * Ambient form: is the *current* device an iPhone? Safe to call anywhere —
 * returns `false` when there is no `navigator`, rather than throwing.
 */
export function isIPhoneDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua: unknown = navigator.userAgent
  return typeof ua === 'string' && isIPhoneUserAgent(ua)
}
