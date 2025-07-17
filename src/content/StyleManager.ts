import { type FodmapStatus } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

/**
 * Configuration object for badge appearance and accessibility properties
 */
type BadgeConfig = {
  title: string // Tooltip text shown on hover
  icon: string // Visual character displayed in the badge
  className: string // CSS classes for styling
  ariaLabel: string // Screen reader description
}

/**
 * Handles styling for FODMAP indicators using Tailwind CSS classes
 */
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
    BADGE_HIGH: 'fodmap-badge-high',
    BADGE_UNKNOWN: 'fodmap-badge-unknown',
    BADGE_PENDING: 'fodmap-badge-pending',
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

  /**
   * Applies FODMAP styling and visibility to a product card element.
   * This is the main public method that coordinates all styling operations.
   *
   * @param card - The HTML element representing the product card
   * @param status - The FODMAP status (LOW, HIGH, UNKNOWN, PENDING)
   * @param shouldHide - Whether the card should be hidden from view
   */
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

  /**
   * Removes all previously applied FODMAP styling from a card element.
   * This includes CSS classes, badges, and resets the card to its original state.
   *
   * @param card - The HTML element to reset
   */
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

  /**
   * Applies visual styling and badge based on the FODMAP status.
   * Each status gets distinctive styling: LOW gets highlighted, HIGH gets dimmed,
   * UNKNOWN gets subtle styling, and PENDING shows processing state.
   *
   * @param card - The HTML element to style
   * @param status - The FODMAP status that determines the styling
   */
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

  /**
   * Controls the visibility of a product card by adding or removing the hidden class.
   * This is used to hide high-FODMAP products when the user enables filtering.
   *
   * @param card - The HTML element to show or hide
   * @param shouldHide - True to hide the card, false to show it
   */
  private static applyVisibility(card: HTMLElement, shouldHide: boolean): void {
    if (shouldHide) {
      card.classList.add(StyleManager.CSS_CLASSES.CARD_HIDDEN)
    } else {
      card.classList.remove(StyleManager.CSS_CLASSES.CARD_HIDDEN)
    }
  }

  /**
   * Creates and adds a visual badge to a product card showing its FODMAP status.
   * The badge includes an icon, tooltip, and accessibility attributes.
   * Positioned absolutely in the top-right corner of the card.
   *
   * @param card - The parent HTML element to attach the badge to
   * @param title - Tooltip text shown on hover
   * @param icon - Visual icon character (✓, ✗, ?, ⋯) displayed in the badge
   * @param className - CSS classes for styling the badge appearance
   * @param ariaLabel - Screen reader description for accessibility
   */
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
