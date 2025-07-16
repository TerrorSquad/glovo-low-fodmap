import { type FodmapStatus } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

type BadgeConfig = {
  title: string
  icon: string
  className: string
  ariaLabel: string
}

/**
 * Handles styling for FODMAP indicators using Tailwind CSS classes
 */
export class StyleManager {
  private static readonly CSS_CLASSES = {
    LOW_HIGHLIGHT: 'fodmap-low-highlight',
    HIGH_DIMMED: 'fodmap-high-dimmed',
    UNKNOWN_SUBTLE: 'fodmap-unknown-subtle',
    PENDING_PROCESSING: 'fodmap-pending-processing',
    CARD_HIDDEN: 'fodmap-card-hidden',
    BADGE: 'fodmap-badge',
    BADGE_HIGH: 'fodmap-badge-high',
    BADGE_UNKNOWN: 'fodmap-badge-unknown',
    BADGE_PENDING: 'fodmap-badge-pending',
  } as const

  private static readonly STATUS_CONFIG: Record<
    FodmapStatus,
    BadgeConfig | null
  > = {
    LOW: {
      title: 'Low-FODMAP - Safe to eat',
      icon: '✓',
      className: StyleManager.CSS_CLASSES.BADGE,
      ariaLabel: 'This product is low in FODMAPs and suitable for the diet',
    },
    HIGH: {
      title: 'High-FODMAP - Avoid',
      icon: '✗',
      className: `${StyleManager.CSS_CLASSES.BADGE} ${StyleManager.CSS_CLASSES.BADGE_HIGH}`,
      ariaLabel: 'This product is high in FODMAPs and should be avoided',
    },
    UNKNOWN: {
      title: 'FODMAP status unknown',
      icon: '?',
      className: `${StyleManager.CSS_CLASSES.BADGE} ${StyleManager.CSS_CLASSES.BADGE_UNKNOWN}`,
      ariaLabel: 'FODMAP status for this product is not yet determined',
    },
    PENDING: {
      title: 'Analyzing FODMAP content...',
      icon: '⋯',
      className: `${StyleManager.CSS_CLASSES.BADGE} ${StyleManager.CSS_CLASSES.BADGE_PENDING}`,
      ariaLabel: 'FODMAP classification is currently being processed',
    },
  }

  static applyToCard(
    card: HTMLElement,
    status: FodmapStatus,
    shouldHide: boolean,
  ): void {
    PerformanceMonitor.measure(
      'applyToCard',
      () => {
        try {
          const currentStatus = card.dataset.fodmapStatus
          const isCurrentlyHidden = card.classList.contains(
            StyleManager.CSS_CLASSES.CARD_HIDDEN,
          )
          const hasBadge =
            card.querySelector(`.${StyleManager.CSS_CLASSES.BADGE}`) !== null
          const shouldShowBadge = StyleManager.STATUS_CONFIG[status] !== null

          // Skip if no changes needed
          if (
            currentStatus === status &&
            isCurrentlyHidden === shouldHide &&
            hasBadge === shouldShowBadge
          ) {
            return
          }

          StyleManager.resetCard(card)
          StyleManager.applyStatus(card, status)
          StyleManager.applyVisibility(card, shouldHide)

          card.dataset.fodmapStatus = status
          card.dataset.fodmapStyleApplied = 'true'
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Style application',
            metadata: { status, shouldHide },
          })
        }
      },
      {
        debugOnly: true, // Only log in debug mode to reduce spam
        threshold: 1, // Only log if it takes more than 1ms
      },
    )
  }

  private static resetCard(card: HTMLElement): void {
    // Remove all FODMAP-related classes
    card.classList.remove(
      StyleManager.CSS_CLASSES.LOW_HIGHLIGHT,
      StyleManager.CSS_CLASSES.HIGH_DIMMED,
      StyleManager.CSS_CLASSES.UNKNOWN_SUBTLE,
      StyleManager.CSS_CLASSES.PENDING_PROCESSING,
      StyleManager.CSS_CLASSES.CARD_HIDDEN,
    )
    card.querySelector(`.${StyleManager.CSS_CLASSES.BADGE}`)?.remove()
    // Don't force position: relative as it might interfere with Glovo's layout
  }

  private static applyStatus(card: HTMLElement, status: FodmapStatus): void {
    const config = StyleManager.STATUS_CONFIG[status]

    // Apply status-specific card styling
    switch (status) {
      case 'LOW':
        card.classList.add(StyleManager.CSS_CLASSES.LOW_HIGHLIGHT)
        break
      case 'HIGH':
        card.classList.add(StyleManager.CSS_CLASSES.HIGH_DIMMED)
        break
      case 'UNKNOWN':
        card.classList.add(StyleManager.CSS_CLASSES.UNKNOWN_SUBTLE)
        break
      case 'PENDING':
        card.classList.add(StyleManager.CSS_CLASSES.PENDING_PROCESSING)
        break
    }

    // Add badge for all statuses
    if (config) {
      StyleManager.addBadge(
        card,
        config.title,
        config.icon,
        config.className,
        config.ariaLabel,
      )
    }
  }

  private static applyVisibility(card: HTMLElement, shouldHide: boolean): void {
    if (shouldHide) {
      card.classList.add(StyleManager.CSS_CLASSES.CARD_HIDDEN)
    } else {
      card.classList.remove(StyleManager.CSS_CLASSES.CARD_HIDDEN)
    }
  }

  private static addBadge(
    card: HTMLElement,
    title: string,
    icon: string,
    className: string,
    ariaLabel: string,
  ): void {
    // Ensure card has relative positioning for badge positioning
    const computedStyle = window.getComputedStyle(card)
    if (computedStyle.position === 'static') {
      card.style.position = 'relative'
    }

    const badge = document.createElement('div')
    badge.className = className
    badge.title = title
    badge.innerHTML = icon
    badge.setAttribute('aria-label', ariaLabel)
    badge.setAttribute('role', 'img')
    card.appendChild(badge)
  }
}
