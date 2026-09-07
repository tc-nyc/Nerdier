/**
 * The user-agent helper. It decides one joke and nothing else, but it still
 * has to be right about iPads and safe in a node process.
 */
import { describe, it, expect } from 'vitest'
import { isIPhoneUserAgent, isIPhoneDevice } from './platform'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const IPOD =
  'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
// iPadOS asks for desktop sites by default and says it is a Mac. Nothing can be
// done about that here, and nothing needs to be: the iPad sees the normal text.
const IPADOS =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36'

describe('isIPhoneUserAgent', () => {
  it('matches an iPhone and an iPod touch', () => {
    expect(isIPhoneUserAgent(IPHONE)).toBe(true)
    expect(isIPhoneUserAgent(IPOD)).toBe(true)
  })

  it('does not match an iPad, a Mac, Android or an empty string', () => {
    expect(isIPhoneUserAgent(IPADOS)).toBe(false)
    expect(isIPhoneUserAgent(ANDROID)).toBe(false)
    expect(isIPhoneUserAgent('')).toBe(false)
  })
})

describe('isIPhoneDevice', () => {
  it('answers without throwing, whatever the environment', () => {
    // This file runs in plain node: there may be no `navigator` at all, and
    // when there is, it is not an iPhone. Either way it must return a boolean
    // rather than blowing up somewhere inside a win celebration.
    expect(typeof isIPhoneDevice()).toBe('boolean')
    expect(isIPhoneDevice()).toBe(false)
  })
})
