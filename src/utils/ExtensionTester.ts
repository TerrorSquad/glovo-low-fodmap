import { Config } from './Config'
import { ErrorHandler } from './ErrorHandler'
import { Logger } from './Logger'
import { MetricsCollector } from './MetricsCollector'

export interface TestResult {
  name: string
  passed: boolean
  duration: number
  error?: string
  details?: Record<string, unknown>
}

export interface TestSuite {
  name: string
  tests: TestResult[]
  passed: boolean
  duration: number
  coverage?: number
}

/**
 * Built-in testing utilities for extension validation
 */
export class ExtensionTester {
  private static readonly TEST_TIMEOUT = 5000 // 5 seconds per test

  /**
   * Runs all available test suites
   */
  static async runAllTests(): Promise<TestSuite[]> {
    Logger.info('ExtensionTester', 'Running comprehensive extension tests')

    const suites: TestSuite[] = []

    // Core functionality tests
    suites.push(await ExtensionTester.runCoreFunctionalityTests())

    // DOM integration tests
    if (typeof document !== 'undefined') {
      suites.push(await ExtensionTester.runDomTests())
    }

    // Storage tests
    if (typeof chrome !== 'undefined' && chrome.storage) {
      suites.push(await ExtensionTester.runStorageTests())
    }

    // Performance tests
    suites.push(await ExtensionTester.runPerformanceTests())

    // Log summary
    const totalTests = suites.reduce(
      (sum, suite) => sum + suite.tests.length,
      0,
    )
    const passedTests = suites.reduce(
      (sum, suite) => sum + suite.tests.filter((t) => t.passed).length,
      0,
    )

    Logger.info(
      'ExtensionTester',
      `Test results: ${passedTests}/${totalTests} passed`,
      {
        suites: suites.map((s) => ({
          name: s.name,
          passed: s.passed,
          tests: s.tests.length,
        })),
      },
    )

    MetricsCollector.record('tests.run', totalTests, {
      passed: passedTests,
      failed: totalTests - passedTests,
    })

    return suites
  }

  /**
   * Tests core extension functionality
   */
  private static async runCoreFunctionalityTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Test Config accessibility
    tests.push(
      await ExtensionTester.runTest('config-accessible', async () => {
        const selectors = Config.SELECTORS
        if (!selectors || !selectors.CARD) {
          throw new Error('Config selectors not accessible')
        }
        return { selectorsCount: Object.keys(selectors).length }
      }),
    )

    // Test Logger functionality
    tests.push(
      await ExtensionTester.runTest('logger-functional', async () => {
        const originalConsoleLog = console.log
        let logCalled = false

        console.log = () => {
          logCalled = true
        }
        Logger.info('Test', 'Test message')
        console.log = originalConsoleLog

        if (!logCalled) {
          throw new Error('Logger did not call console.log')
        }

        return { loggerWorking: true }
      }),
    )

    // Test MetricsCollector
    tests.push(
      await ExtensionTester.runTest('metrics-functional', async () => {
        const initialSummary = MetricsCollector.getSummary()
        const initialCount = initialSummary.totalEvents

        MetricsCollector.record('test.metric', 123)

        const newSummary = MetricsCollector.getSummary()
        if (newSummary.totalEvents !== initialCount + 1) {
          throw new Error('MetricsCollector did not record event')
        }

        return { eventsRecorded: newSummary.totalEvents }
      }),
    )

    const duration = Date.now() - startTime
    const passed = tests.every((t) => t.passed)

    return {
      name: 'Core Functionality',
      tests,
      passed,
      duration,
    }
  }

  /**
   * Tests DOM manipulation capabilities
   */
  private static async runDomTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Test DOM ready state
    tests.push(
      await ExtensionTester.runTest('dom-ready', async () => {
        if (document.readyState !== 'complete') {
          throw new Error(`DOM not ready: ${document.readyState}`)
        }
        return { readyState: document.readyState }
      }),
    )

    // Test style injection capability
    tests.push(
      await ExtensionTester.runTest('style-injection', async () => {
        const testId = 'extension-test-style'

        // Remove any existing test style
        const existing = document.getElementById(testId)
        if (existing) existing.remove()

        // Create test style
        const style = document.createElement('style')
        style.id = testId
        style.textContent = '.test-class { display: none; }'
        document.head.appendChild(style)

        // Verify injection
        const injected = document.getElementById(testId)
        if (!injected) {
          throw new Error('Failed to inject test style')
        }

        // Cleanup
        injected.remove()

        return { styleInjected: true }
      }),
    )

    // Test element selection
    tests.push(
      await ExtensionTester.runTest('element-selection', async () => {
        const bodyElements = document.querySelectorAll('body')
        const allElements = document.querySelectorAll('*')

        if (bodyElements.length !== 1) {
          throw new Error('Could not find exactly one body element')
        }

        return {
          bodyElements: bodyElements.length,
          totalElements: allElements.length,
        }
      }),
    )

    const duration = Date.now() - startTime
    const passed = tests.every((t) => t.passed)

    return {
      name: 'DOM Integration',
      tests,
      passed,
      duration,
    }
  }

  /**
   * Tests Chrome storage functionality
   */
  private static async runStorageTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Test storage write/read
    tests.push(
      await ExtensionTester.runTest('storage-read-write', async () => {
        const testKey = 'extension-test-key'
        const testValue = { timestamp: Date.now(), test: true }

        // Write test data
        await chrome.storage.local.set({ [testKey]: testValue })

        // Read test data
        const result = await chrome.storage.local.get(testKey)

        if (!result[testKey] || result[testKey].test !== true) {
          throw new Error('Storage write/read failed')
        }

        // Cleanup
        await chrome.storage.local.remove(testKey)

        return { storageWorking: true }
      }),
    )

    // Test storage sync vs local
    tests.push(
      await ExtensionTester.runTest('storage-sync-available', async () => {
        try {
          await chrome.storage.sync.get('test-probe')
          return { syncAvailable: true }
        } catch (error) {
          return {
            syncAvailable: false,
            error: error instanceof Error ? error.message : String(error),
          }
        }
      }),
    )

    const duration = Date.now() - startTime
    const passed = tests.every((t) => t.passed)

    return {
      name: 'Chrome Storage',
      tests,
      passed,
      duration,
    }
  }

  /**
   * Tests performance characteristics
   */
  private static async runPerformanceTests(): Promise<TestSuite> {
    const tests: TestResult[] = []
    const startTime = Date.now()

    // Test memory usage
    tests.push(
      await ExtensionTester.runTest('memory-usage', async () => {
        if ('memory' in performance) {
          const memory = (performance as any).memory
          const usedMB = memory.usedJSHeapSize / 1024 / 1024
          const limitMB = memory.jsHeapSizeLimit / 1024 / 1024
          const usagePercent = (usedMB / limitMB) * 100

          if (usagePercent > 90) {
            throw new Error(`High memory usage: ${usagePercent.toFixed(1)}%`)
          }

          return {
            usedMB: Math.round(usedMB * 100) / 100,
            limitMB: Math.round(limitMB * 100) / 100,
            usagePercent: Math.round(usagePercent * 100) / 100,
          }
        }

        return { memoryAPIUnavailable: true }
      }),
    )

    // Test function execution speed
    tests.push(
      await ExtensionTester.runTest('execution-speed', async () => {
        const iterations = 1000
        const startTime = performance.now()

        // Run a simple computation many times
        for (let i = 0; i < iterations; i++) {
          const obj = { test: true, value: i * 2 }
          JSON.stringify(obj)
        }

        const duration = performance.now() - startTime
        const avgTime = duration / iterations

        if (avgTime > 1) {
          // More than 1ms per operation is concerning
          throw new Error(
            `Slow execution: ${avgTime.toFixed(3)}ms per operation`,
          )
        }

        return {
          iterations,
          totalMs: Math.round(duration * 100) / 100,
          avgMs: Math.round(avgTime * 1000) / 1000,
        }
      }),
    )

    const duration = Date.now() - startTime
    const passed = tests.every((t) => t.passed)

    return {
      name: 'Performance',
      tests,
      passed,
      duration,
    }
  }

  /**
   * Runs a single test with timeout protection
   */
  private static async runTest(
    name: string,
    testFn: () => Promise<Record<string, unknown>>,
  ): Promise<TestResult> {
    const startTime = Date.now()

    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Test timeout')),
          ExtensionTester.TEST_TIMEOUT,
        )
      })

      const details = (await Promise.race([
        testFn(),
        timeoutPromise,
      ])) as Record<string, unknown>

      const duration = Date.now() - startTime

      return {
        name,
        passed: true,
        duration,
        details,
      }
    } catch (error) {
      const duration = Date.now() - startTime

      return {
        name,
        passed: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  /**
   * Quick health check - runs essential tests only
   */
  static async quickHealthCheck(): Promise<boolean> {
    try {
      const coreTests = await ExtensionTester.runCoreFunctionalityTests()
      return coreTests.passed
    } catch (error) {
      ErrorHandler.logError('ExtensionTester', error, {
        context: 'Quick health check failed',
      })
      return false
    }
  }

  /**
   * Generates a test report for diagnostics
   */
  static async generateTestReport(): Promise<string> {
    const suites = await ExtensionTester.runAllTests()

    let report = '# Extension Test Report\n\n'
    report += `Generated: ${new Date().toISOString()}\n\n`

    for (const suite of suites) {
      report += `## ${suite.name}\n`
      report += `Status: ${suite.passed ? '✅ PASSED' : '❌ FAILED'}\n`
      report += `Duration: ${suite.duration}ms\n`
      report += `Tests: ${suite.tests.filter((t) => t.passed).length}/${suite.tests.length} passed\n\n`

      for (const test of suite.tests) {
        const status = test.passed ? '✅' : '❌'
        report += `- ${status} ${test.name} (${test.duration}ms)\n`

        if (!test.passed && test.error) {
          report += `  Error: ${test.error}\n`
        }

        if (test.details && Object.keys(test.details).length > 0) {
          report += `  Details: ${JSON.stringify(test.details)}\n`
        }
      }

      report += '\n'
    }

    return report
  }
}
