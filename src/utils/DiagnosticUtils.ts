import { Config } from './Config'
import { ErrorHandler } from './ErrorHandler'
import { ExtensionTester } from './ExtensionTester'
import { FeatureFlags } from './FeatureFlags'
import { HealthMonitor, type SystemHealth } from './HealthMonitor'
import { Logger } from './Logger'
import { MetricsCollector, type MetricsSummary } from './MetricsCollector'

export interface DiagnosticReport {
  timestamp: number
  version: string
  url?: string
  config: Record<string, unknown>
  featureFlags: Record<string, boolean | number | string>
  health: SystemHealth
  metrics: MetricsSummary
  environment: Record<string, unknown>
  dom?: Record<string, unknown>
}

/**
 * Diagnostic utilities for troubleshooting
 */
export class DiagnosticUtils {
  /**
   * Generates a comprehensive diagnostic report
   */
  static async generateReport(): Promise<DiagnosticReport> {
    const timestamp = Date.now()

    Logger.info('Diagnostics', 'Generating diagnostic report')

    // Gather all diagnostic information
    const health = await HealthMonitor.performHealthCheck()
    const metrics = MetricsCollector.getSummary()
    const config = Config.getInfo()
    const featureFlags = FeatureFlags.getAllFlags()
    const environment = DiagnosticUtils.getEnvironmentInfo()

    const report: DiagnosticReport = {
      timestamp,
      version: chrome.runtime.getManifest().version,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      config,
      featureFlags,
      health,
      metrics,
      environment,
    }

    // Add DOM information if we're in a content script
    if (typeof document !== 'undefined') {
      report.dom = DiagnosticUtils.getDomInfo()
    }

    Logger.info('Diagnostics', 'Diagnostic report generated', {
      overall: health.overall,
      totalMetrics: metrics.totalEvents,
    })

    return report
  }

  /**
   * Gets environment information
   */
  private static getEnvironmentInfo(): Record<string, unknown> {
    const info: Record<string, unknown> = {
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      timestamp: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }

    // Chrome extension specific info
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      info.extensionId = chrome.runtime.id
      info.manifest = chrome.runtime.getManifest()
    }

    // Performance API info
    if (typeof performance !== 'undefined') {
      info.performanceNow = performance.now()

      if ('memory' in performance) {
        const memory = (performance as any).memory
        info.memory = {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        }
      }
    }

    return info
  }

  /**
   * Gets DOM-specific information (content script only)
   */
  private static getDomInfo(): Record<string, unknown> {
    try {
      const productCards = document.querySelectorAll(Config.SELECTORS.CARD)
      const styledCards = document.querySelectorAll(
        `${Config.SELECTORS.CARD}[data-fodmap-status]`,
      )
      const injectedStyles = document.getElementById(
        Config.CSS_CLASSES.STYLE_ID,
      )

      return {
        url: window.location.href,
        title: document.title,
        totalCards: productCards.length,
        styledCards: styledCards.length,
        stylesInjected: !!injectedStyles,
        readyState: document.readyState,
        visibilityState: document.visibilityState,
        documentElement: {
          scrollTop: document.documentElement.scrollTop,
          scrollHeight: document.documentElement.scrollHeight,
          clientHeight: document.documentElement.clientHeight,
        },
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Exports diagnostic data as JSON string
   */
  static async exportDiagnostics(): Promise<string> {
    const report = await DiagnosticUtils.generateReport()
    return JSON.stringify(report, null, 2)
  }

  /**
   * Logs diagnostic summary to console
   */
  static async logDiagnostics(): Promise<void> {
    const report = await DiagnosticUtils.generateReport()

    Logger.group('🔍 Diagnostic Report', () => {
      Logger.info('Diagnostics', `Version: ${report.version}`)
      Logger.info(
        'Diagnostics',
        `Overall Health: ${report.health.overall.toUpperCase()}`,
      )
      Logger.info('Diagnostics', `Total Metrics: ${report.metrics.totalEvents}`)
      Logger.info(
        'Diagnostics',
        `Session Duration: ${(report.metrics.sessionDuration / 1000 / 60).toFixed(1)} minutes`,
      )

      if (report.url) {
        Logger.info('Diagnostics', `Current URL: ${report.url}`)
      }

      if (report.dom) {
        Logger.info(
          'Diagnostics',
          `Product Cards: ${report.dom.totalCards} (${report.dom.styledCards} styled)`,
        )
      }

      // Show any health issues
      const issues = report.health.checks.filter((c) => c.status !== 'healthy')
      if (issues.length > 0) {
        Logger.warn('Diagnostics', 'Health Issues:', {
          issues: issues.map((i) => `${i.component}: ${i.message}`),
        })
      }
    })
  }

  /**
   * Downloads diagnostic report as a file (browser only)
   */
  static async downloadDiagnostics(): Promise<void> {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      Logger.warn('Diagnostics', 'Download not available in this context')
      return
    }

    try {
      const reportJson = await DiagnosticUtils.exportDiagnostics()
      const blob = new Blob([reportJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `fodmap-diagnostics-${Date.now()}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      Logger.info('Diagnostics', 'Diagnostic report downloaded')
    } catch (error) {
      ErrorHandler.logError('Diagnostics', error, {
        context: 'Downloading diagnostic report',
      })
    }
  }

  /**
   * Quick health check with simplified output
   */
  static async quickHealthCheck(): Promise<string> {
    const health = await HealthMonitor.performHealthCheck()
    return HealthMonitor.getHealthSummary(health)
  }

  /**
   * Clears all diagnostic data
   */
  static clearAllData(): void {
    MetricsCollector.clear()
    Logger.info('Diagnostics', 'All diagnostic data cleared')
  }

  /**
   * Performance debugging helper
   */
  static debugPerformance(): void {
    Logger.group('⚡ Performance Debug', () => {
      const metrics = MetricsCollector.getSummary()
      const performanceEvents = Object.entries(metrics.eventCounts)
        .filter(([name]) => name.startsWith('performance.'))
        .sort(([, a], [, b]) => b - a)

      if (performanceEvents.length > 0) {
        Logger.info('Diagnostics', 'Top Performance Metrics:', {
          metrics: performanceEvents
            .slice(0, 10)
            .map(([name, count]) => `${name}: ${count}`),
        })
      } else {
        Logger.info('Diagnostics', 'No performance metrics collected')
      }

      // Show memory usage if available
      if ('memory' in performance) {
        const memory = (performance as any).memory
        Logger.info('Diagnostics', 'Memory Usage:', {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
          usage: `${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)}%`,
        })
      }
    })
  }

  /**
   * Runs built-in extension tests
   */
  static async runTests(): Promise<void> {
    Logger.info('Diagnostics', 'Running extension tests...')

    try {
      const suites = await ExtensionTester.runAllTests()
      const totalTests = suites.reduce(
        (sum, suite) => sum + suite.tests.length,
        0,
      )
      const passedTests = suites.reduce(
        (sum, suite) => sum + suite.tests.filter((t) => t.passed).length,
        0,
      )

      Logger.group('🧪 Test Results', () => {
        Logger.info(
          'Diagnostics',
          `Overall: ${passedTests}/${totalTests} tests passed`,
        )

        for (const suite of suites) {
          const status = suite.passed ? '✅' : '❌'
          const passedCount = suite.tests.filter((t) => t.passed).length
          Logger.info(
            'Diagnostics',
            `${status} ${suite.name}: ${passedCount}/${suite.tests.length} passed`,
          )

          // Show failed tests
          const failedTests = suite.tests.filter((t) => !t.passed)
          if (failedTests.length > 0) {
            for (const test of failedTests) {
              Logger.warn('Diagnostics', `  ❌ ${test.name}: ${test.error}`)
            }
          }
        }
      })
    } catch (error) {
      ErrorHandler.logError('Diagnostics', error, {
        context: 'Running extension tests',
      })
    }
  }

  /**
   * Quick test for basic functionality
   */
  static async quickTest(): Promise<boolean> {
    try {
      return await ExtensionTester.quickHealthCheck()
    } catch (error) {
      ErrorHandler.logError('Diagnostics', error, {
        context: 'Running quick test',
      })
      return false
    }
  }
}
