import '@/assets/content.css'
import { DomProductScanner } from '@/entrypoints/content/DomProductScanner'
import { FodmapHelper } from '@/entrypoints/content/FodmapHelper'
import { DiagnosticUtils } from '@/utils/DiagnosticUtils'
import { Logger } from '@/utils/Logger'

export default defineContentScript({
  matches: ['https://glovoapp.com/*'],
  runAt: 'document_end',
  main() {
    // Initialize the application
    const fodmapHelper = new FodmapHelper()
    fodmapHelper.init()

    const isDevelopment = process.env.NODE_ENV === 'development'

    // Expose debugging utilities globally only in development mode
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
      Logger.info(
        'Content',
        'Debug utilities available at window.fodmapDebug',
        {
          methods: Object.keys(debugUtils),
        },
      )
    }

    // Message listener for popup communications
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.action === 'updateTooltipFontSize') {
        updateTooltipFontSize(Number(message.fontSize))
        sendResponse({ success: true })
      }
      return true // Keep message channel open for async response
    })

    /**
     * Updates the font size of all FODMAP tooltips
     */
    function updateTooltipFontSize(fontSize: number): void {
      const style = document.createElement('style')
      style.id = 'fodmap-tooltip-font-size'
      const existingStyle = document.getElementById('fodmap-tooltip-font-size')
      if (existingStyle) existingStyle.remove()
      style.textContent = `
		.fodmap-tooltip { font-size: ${fontSize}px !important; }
		.fodmap-tooltip-title { font-size: ${fontSize + 1}px !important; }
		.fodmap-tooltip-explanation { font-size: ${fontSize - 1}px !important; }
	  `
      document.head.appendChild(style)
      Logger.info('Content', `Updated tooltip font size to ${fontSize}px`)
    }
  },
})
