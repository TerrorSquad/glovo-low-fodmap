import { FodmapHelper } from './content/FodmapHelper'
import { DiagnosticUtils } from './shared/DiagnosticUtils'
import { Logger } from './shared/Logger'

// Initialize the application
const fodmapHelper = new FodmapHelper()
fodmapHelper.init()

// Expose debugging utilities globally (only in development)
if (process.env.NODE_ENV === 'development') {
  const debugUtils = {
    helper: fodmapHelper,
    diagnostics: DiagnosticUtils,
    async report() {
      return await DiagnosticUtils.generateReport()
    },
    async health() {
      console.log(await DiagnosticUtils.quickHealthCheck())
    },
    async logs() {
      await DiagnosticUtils.logDiagnostics()
    },
    performance() {
      DiagnosticUtils.debugPerformance()
    },
  }

  // Make available globally
  ;(window as any).fodmapDebug = debugUtils

  Logger.info('Content', 'Debug utilities available at window.fodmapDebug')
}
