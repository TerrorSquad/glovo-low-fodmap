import type { FodmapStatus } from '@/utils/db'
import { ErrorHandler } from '@/utils/ErrorHandler'

type BadgeConfig = {
  title: string
  icon: string
  className: string
  ariaLabel: string
}

export class StyleManager {
  /**
   * CSS class names used for styling product cards and badges.
   * These correspond to styles defined in the extension's CSS file.
   */
  private static readonly CSS_CLASSES = {
    LOW_HIGHLIGHT: 'fodmap-low-highlight',
    HIGH_DIMMED: 'fodmap-high-dimmed',
    UNKNOWN_SUBTLE: 'fodmap-unknown-subtle',
    PENDING_PROCESSING: 'fodmap-pending-processing',
    CARD_HIDDEN: 'fodmap-card-hidden',
    BADGE: 'fodmap-badge',
    BADGE_MODERATE: 'fodmap-badge-moderate',
    BADGE_HIGH: 'fodmap-badge-high',
    BADGE_UNKNOWN: 'fodmap-badge-unknown',
    BADGE_PENDING: 'fodmap-badge-pending',
    TOOLTIP: 'fodmap-tooltip',
    TOOLTIP_VISIBLE: 'fodmap-tooltip-visible',
  } as const

  /**
   * Configuration for each FODMAP status defining the badge appearance and accessibility.
   * Each status has specific visual indicators and user-friendly descriptions.
   * null values mean no badge should be shown for that status.
   */
  private static readonly STATUS_CONFIG: Record<
    FodmapStatus,
    BadgeConfig | null
  > = {
    LOW: {
      title: 'Low-FODMAP - Bezbedno za konzumaciju',
      icon: '✓',
      className: StyleManager.CSS_CLASSES.BADGE,
      ariaLabel: 'Ovaj proizvod ima nizak sadržaj FODMAP-a',
    },
    MODERATE: {
      title: 'Umeren-FODMAP - Konzumirati sa oprezom',
      icon: '⚠',
      className: `${StyleManager.CSS_CLASSES.BADGE} ${StyleManager.CSS_CLASSES.BADGE_MODERATE}`,
      ariaLabel:
        'Ovaj proizvod ima umeren sadržaj FODMAP-a - konzumirati u malim porcijama',
    },
    HIGH: {
      title: 'High-FODMAP - Izbegavati',
      icon: '✗',
      className: `${StyleManager.CSS_CLASSES.BADGE} ${StyleManager.CSS_CLASSES.BADGE_HIGH}`,
      ariaLabel:
        'Ovaj proizvod ima visok sadržaj FODMAP-a i treba ga izbegavati',
    },
    UNKNOWN: {
      title: 'FODMAP status nepoznat',
      icon: '?',
      className: `${StyleManager.CSS_CLASSES.BADGE} ${StyleManager.CSS_CLASSES.BADGE_UNKNOWN}`,
      ariaLabel: 'FODMAP status za ovaj proizvod još nije utvrđen',
    },
    PENDING: {
      title: 'Analizira se FODMAP sadržaj...',
      icon: '⋯',
      className: `${StyleManager.CSS_CLASSES.BADGE} ${StyleManager.CSS_CLASSES.BADGE_PENDING}`,
      ariaLabel: 'FODMAP klasifikacija je u toku',
    },
  }

  static applyToCard(
    card: HTMLElement,
    product: { status: FodmapStatus; explanation?: string; isFood?: boolean },
    shouldHide: boolean,
  ): void {
    try {
      const currentStatus = card.dataset.fodmapStatus
      const isCurrentlyHidden = card.classList.contains(
        StyleManager.CSS_CLASSES.CARD_HIDDEN,
      )

      // Optimization: If the status and visibility are unchanged, skip reapplying styles
      if (
        currentStatus === product.status &&
        isCurrentlyHidden === shouldHide
      ) {
        return
      }

      StyleManager.resetCard(card)
      StyleManager.applyStatus(card, product.status, product.explanation)
      StyleManager.applyVisibility(card, shouldHide)

      card.dataset.fodmapStatus = product.status
    } catch (error) {
      ErrorHandler.logError('Content', error, {
        context: 'Style application',
        metadata: { status: product.status, shouldHide },
      })
    }
  }

  /**
   * Removes all previously applied FODMAP styling from a card element.
   * This includes CSS classes, badges, and resets the card to its original state.
   *
   * @param card - The HTML element to reset
   */
  private static resetCard(card: HTMLElement): void {
    card.classList.remove(
      StyleManager.CSS_CLASSES.LOW_HIGHLIGHT,
      StyleManager.CSS_CLASSES.HIGH_DIMMED,
      StyleManager.CSS_CLASSES.UNKNOWN_SUBTLE,
      StyleManager.CSS_CLASSES.PENDING_PROCESSING,
      StyleManager.CSS_CLASSES.CARD_HIDDEN,
    )
    card.querySelector(`.${StyleManager.CSS_CLASSES.BADGE}`)?.remove()
  }

  /**
   * Applies visual styling and badge based on the FODMAP status.
   * Each status gets distinctive styling: LOW gets highlighted, MODERATE gets warning,
   * HIGH gets dimmed, UNKNOWN gets subtle styling, and PENDING shows processing state.
   *
   * @param card - The HTML element to style
   * @param status - The FODMAP status that determines the styling
   * @param explanation - Optional Serbian explanation for the FODMAP status
   */
  private static applyStatus(
    card: HTMLElement,
    status: FodmapStatus,
    explanation?: string,
  ): void {
    const config = StyleManager.STATUS_CONFIG[status]

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

    if (config) {
      StyleManager.addBadge(card, config, explanation)
    }
  }

  /**
   * Controls the visibility of a product card by adding or removing the hidden class.
   * This is used to hide high-FODMAP products when the user enables filtering.
   *
   * @param card - The HTML element to show or hide
   * @param shouldHide - True to hide the card, false to show it
   */
  private static applyVisibility(card: HTMLElement, shouldHide: boolean): void {
    card.classList.toggle(StyleManager.CSS_CLASSES.CARD_HIDDEN, shouldHide)
  }

  /**
   * Creates and appends a badge to the product card.
   * The badge visually indicates the FODMAP status and provides an accessible label.
   */
  private static addBadge(
    card: HTMLElement,
    config: BadgeConfig,
    explanation?: string,
  ): void {
    if (card.querySelector(`.${StyleManager.CSS_CLASSES.BADGE}`)) return

    const computedStyle = window.getComputedStyle(card)
    if (computedStyle.position === 'static') {
      card.style.position = 'relative'
    }

    const badge = document.createElement('div')
    badge.className = config.className
    badge.innerHTML = config.icon
    badge.setAttribute('aria-label', config.ariaLabel)
    badge.setAttribute('role', 'img')

    // Add listeners to create and destroy tooltip as needed
    StyleManager.addDynamicTooltipEvents(badge, config.title, explanation)

    card.appendChild(badge)
  }

  /**
   * Adds event listeners that dynamically create, show, and remove the tooltip.
   */
  private static addDynamicTooltipEvents(
    badge: HTMLElement,
    title: string,
    explanation?: string,
  ) {
    let tooltipElement: HTMLElement | null = null
    let hoverTimeout: number

    const showTooltip = () => {
      // Create tooltip only if it doesn't already exist
      if (!tooltipElement) {
        tooltipElement = document.createElement('div')
        tooltipElement.className = StyleManager.CSS_CLASSES.TOOLTIP

        tooltipElement.innerHTML = explanation
          ? `<div class="fodmap-tooltip-title">${title}</div><div class="fodmap-tooltip-explanation">${explanation}</div>`
          : `<div class="fodmap-tooltip-title">${title}</div>`

        document.body.appendChild(tooltipElement)
      }

      // Position and show
      StyleManager.positionTooltip(badge, tooltipElement)
      tooltipElement.classList.add(StyleManager.CSS_CLASSES.TOOLTIP_VISIBLE)
    }

    const hideTooltip = () => {
      if (tooltipElement) {
        tooltipElement.classList.remove(
          StyleManager.CSS_CLASSES.TOOLTIP_VISIBLE,
        )
        // Remove tooltip from DOM after exit animation completes (if it exists)
        setTimeout(() => {
          tooltipElement?.remove()
          tooltipElement = null
        }, 300) // Time should match CSS transition
      }
    }

    badge.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout)
      hoverTimeout = window.setTimeout(showTooltip, 200) // Small delay
    })

    badge.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout)
      hideTooltip()
    })
  }

  /**
   * Positions the tooltip to ensure it doesn't go off-screen.
   */
  private static positionTooltip(
    badge: HTMLElement,
    tooltip: HTMLElement,
  ): void {
    const badgeRect = badge.getBoundingClientRect()

    // Position tooltip above the badge, centered
    let top = badgeRect.top - tooltip.offsetHeight - 8 // 8px margin
    let left = badgeRect.left + badge.offsetWidth / 2 - tooltip.offsetWidth / 2

    // Check if it goes off-screen upwards
    if (top < 0) {
      top = badgeRect.bottom + 8 // If it goes off-screen, show it below
    }

    // Check if it goes off-screen left/right
    if (left < 0) {
      left = 5 // Minimal margin
    } else if (left + tooltip.offsetWidth > window.innerWidth) {
      left = window.innerWidth - tooltip.offsetWidth - 5
    }

    tooltip.style.left = `${left}px`
    tooltip.style.top = `${top}px`
  }
}
