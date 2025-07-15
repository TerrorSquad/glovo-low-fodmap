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
    CARD_HIDDEN: 'fodmap-card-hidden',
    BADGE: 'fodmap-badge',
    BADGE_HIGH: 'fodmap-badge-high',
  } as const

  private static readonly STATUS_CONFIG: Record<
    FodmapStatus,
    BadgeConfig | null
  > = {
    LOW: {
      title: 'Low-FODMAP',
      icon: StyleManager.getCheckIcon(),
      className: StyleManager.CSS_CLASSES.BADGE,
      ariaLabel: 'This product is low in FODMAPs and suitable for the diet',
    },
    HIGH: {
      title: 'High-FODMAP',
      icon: StyleManager.getCrossIcon(),
      className: `${StyleManager.CSS_CLASSES.BADGE} ${StyleManager.CSS_CLASSES.BADGE_HIGH}`,
      ariaLabel: 'This product is high in FODMAPs and should be avoided',
    },
    UNKNOWN: null,
    PENDING: null,
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
      StyleManager.CSS_CLASSES.CARD_HIDDEN,
    )
    card.querySelector(`.${StyleManager.CSS_CLASSES.BADGE}`)?.remove()
    card.style.position = 'relative'
  }

  private static applyStatus(card: HTMLElement, status: FodmapStatus): void {
    const config = StyleManager.STATUS_CONFIG[status]

    if (config) {
      if (status === 'LOW') {
        card.classList.add(StyleManager.CSS_CLASSES.LOW_HIGHLIGHT)
      }

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
    const badge = document.createElement('div')
    badge.className = className
    badge.title = title
    badge.innerHTML = icon
    badge.setAttribute('aria-label', ariaLabel)
    badge.setAttribute('role', 'img')
    card.appendChild(badge)
  }

  private static getCheckIcon(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>`
  }

  private static getCrossIcon(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"/></svg>`
  }
}
