/**
 * The bundle's entry: the dashboard lazy-imports this module and renders its
 * default export as the app's page.
 *
 * Subscribing to the host's language generation here is what repaints the page
 * on a language switch: `t` reads the active locale at call time, and this
 * component's re-render reaches every child. The host's scoped API client is
 * bound here too, before the page's first request. The host mounts the page
 * inside a React Query client of the app's own.
 */
import { useAppApi, useLanguageGeneration } from '@kirocrew/app-sdk'
import { useEffect } from 'react'
import { bindAppApi } from './api'
import PulsePage from './PulsePage'
import { ensureStyles } from './styles'

export default function PulseApp() {
  useLanguageGeneration()
  bindAppApi(useAppApi())
  useEffect(() => ensureStyles(), [])
  return <PulsePage />
}
