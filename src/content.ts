import './styles/content.css'
import { DomProductScanner } from './content/DomProductScanner'
import { FodmapHelper } from './content/FodmapHelper'
import { DiagnosticUtils } from './shared/DiagnosticUtils'
import { Logger } from './shared/Logger'

// Initialize the application
const fodmapHelper = new FodmapHelper()
fodmapHelper.init()

// Check if we're in development mode by looking for localhost in manifest permissions
const isDevelopment =
  chrome.runtime
    .getManifest()
    .host_permissions?.includes('http://localhost/*') ?? false

// Expose debugging utilities globally only in development mode
if (isDevelopment) {
  Logger.info('Content', '🚀 FODMAP Helper: Setting up debug utilities...')
} else {
  Logger.info(
    'Content',
    '🚀 FODMAP Helper: Production mode - debug utilities disabled',
  )
}

const debugUtils = {
  helper: fodmapHelper,
  scanner: DomProductScanner,
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
  async tests() {
    await DiagnosticUtils.runTests()
  },
  async quickTest() {
    const passed = await DiagnosticUtils.quickTest()
    console.log(`Quick test: ${passed ? '✅ PASSED' : '❌ FAILED'}`)
    return passed
  },
  // DOM scanning utilities
  analyzePage() {
    Logger.info('Content', '🔍 Starting page analysis...')
    DomProductScanner.analyzePage()
  },
  scanNow() {
    Logger.info('Content', '🔍 Starting manual scan...')
    const result = DomProductScanner.scanPage()
    Logger.info('Content', 'Scan result completed', {
      scannedElements: result.scannedElements,
      extractedProducts: result.extractedProducts,
      errors: result.errors.length,
    })
    return result
  },
}

// Make available globally only in development mode
if (isDevelopment) {
  ;(window as any).fodmapDebug = debugUtils

  Logger.info(
    'Content',
    '✅ FODMAP Helper: Debug utilities available at window.fodmapDebug',
  )
  Logger.info(
    'Content',
    'Available methods: ' + Object.keys(debugUtils).join(', '),
  )

  Logger.info('Content', 'Debug utilities available at window.fodmapDebug', {
    methods: Object.keys(debugUtils),
  })
}
