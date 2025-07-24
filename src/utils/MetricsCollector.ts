import { Config } from './Config'
import { Logger } from './Logger'

export interface MetricEvent {
  name: string
  value?: number
  metadata?: Record<string, unknown>
  timestamp: number
}

export interface MetricsSummary {
  totalEvents: number
  eventCounts: Record<string, number>
  lastEvent: MetricEvent | null
  sessionStartTime: number
  sessionDuration: number
}

/**
 * Simple metrics collection for extension usage analytics
 */
export class MetricsCollector {
  private static events: MetricEvent[] = []
  private static sessionStartTime = Date.now()
  private static maxEvents = 1000 // Prevent memory bloat

  /**
   * Records a metric event
   */
  static record(
    name: string,
    value?: number,
    metadata?: Record<string, unknown>,
  ): void {
    const event: MetricEvent = {
      name,
      value,
      metadata,
      timestamp: Date.now(),
    }

    MetricsCollector.events.push(event)

    // Keep only the latest events to prevent memory issues
    if (MetricsCollector.events.length > MetricsCollector.maxEvents) {
      MetricsCollector.events = MetricsCollector.events.slice(
        -MetricsCollector.maxEvents,
      )
    }

    Logger.debug('Metrics', `Recorded event: ${name}`, { value, metadata })
  }

  /**
   * Records an error occurrence
   */
  static recordError(
    component: string,
    error: string,
    metadata?: Record<string, unknown>,
  ): void {
    MetricsCollector.record(`error.${component}`, 1, { error, ...metadata })
  }

  /**
   * Records a feature usage
   */
  static recordFeatureUsage(
    feature: string,
    metadata?: Record<string, unknown>,
  ): void {
    MetricsCollector.record(`feature.${feature}`, 1, metadata)
  }

  /**
   * Records API interaction
   */
  static recordApiCall(
    endpoint: string,
    success: boolean,
    durationMs?: number,
  ): void {
    MetricsCollector.record(
      `api.${success ? 'success' : 'error'}`,
      durationMs,
      { endpoint },
    )
  }

  /**
   * Gets metrics summary
   */
  static getSummary(): MetricsSummary {
    const eventCounts: Record<string, number> = {}

    for (const event of MetricsCollector.events) {
      eventCounts[event.name] = (eventCounts[event.name] || 0) + 1
    }

    return {
      totalEvents: MetricsCollector.events.length,
      eventCounts,
      lastEvent:
        MetricsCollector.events.length > 0
          ? MetricsCollector.events[MetricsCollector.events.length - 1]
          : null,
      sessionStartTime: MetricsCollector.sessionStartTime,
      sessionDuration: Date.now() - MetricsCollector.sessionStartTime,
    }
  }

  /**
   * Gets events for a specific metric
   */
  static getEvents(metricName: string): MetricEvent[] {
    return MetricsCollector.events.filter((event) => event.name === metricName)
  }

  /**
   * Gets events within a time range
   */
  static getEventsInRange(startTime: number, endTime: number): MetricEvent[] {
    return MetricsCollector.events.filter(
      (event) => event.timestamp >= startTime && event.timestamp <= endTime,
    )
  }

  /**
   * Gets recent events (last N events)
   */
  static getRecentEvents(count = 50): MetricEvent[] {
    return MetricsCollector.events.slice(-count)
  }

  /**
   * Calculates average value for a metric
   */
  static getAverageValue(metricName: string): number {
    const events = MetricsCollector.getEvents(metricName)
    const valuesWithNumbers = events.filter((e) => typeof e.value === 'number')

    if (valuesWithNumbers.length === 0) return 0

    const sum = valuesWithNumbers.reduce(
      (acc, event) => acc + (event.value || 0),
      0,
    )
    return sum / valuesWithNumbers.length
  }

  /**
   * Gets top events by frequency
   */
  static getTopEvents(limit = 10): Array<{ name: string; count: number }> {
    const summary = MetricsCollector.getSummary()

    return Object.entries(summary.eventCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([name, count]) => ({ name, count }))
  }

  /**
   * Clears all metrics data
   */
  static clear(): void {
    MetricsCollector.events = []
    MetricsCollector.sessionStartTime = Date.now()
    Logger.debug('Metrics', 'All metrics data cleared')
  }

  /**
   * Exports metrics data for analysis
   */
  static export(): {
    summary: MetricsSummary
    events: MetricEvent[]
    config: Record<string, unknown>
  } {
    return {
      summary: MetricsCollector.getSummary(),
      events: [...MetricsCollector.events], // Copy to prevent mutation
      config: Config.getInfo(),
    }
  }

  /**
   * Logs a metrics summary
   */
  static logSummary(): void {
    const summary = MetricsCollector.getSummary()
    const topEvents = MetricsCollector.getTopEvents(5)

    Logger.info('Metrics', 'Session metrics summary', {
      totalEvents: summary.totalEvents,
      sessionDuration: `${(summary.sessionDuration / 1000 / 60).toFixed(1)} minutes`,
      topEvents,
    })
  }

  /**
   * Records extension startup metrics
   */
  static recordStartup(context: string): void {
    MetricsCollector.record(
      'startup',
      Date.now() - MetricsCollector.sessionStartTime,
      {
        context,
        config: Config.getInfo(),
      },
    )
  }

  /**
   * Records page-specific metrics
   */
  static recordPageMetrics(): void {
    if (typeof document === 'undefined') return

    const productCards = document.querySelectorAll(Config.SELECTORS.CARD)
    const styledCards = document.querySelectorAll(
      `${Config.SELECTORS.CARD}[data-fodmap-status]`,
    )

    MetricsCollector.record('page.products_found', productCards.length, {
      url: window.location.href,
      styledCards: styledCards.length,
    })
  }
}
