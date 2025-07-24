import type { FodmapStatus } from '@/utils/db'
import { ErrorHandler } from '@/utils/ErrorHandler'

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
      title: 'Low-FODMAP - Safe to eat',
      icon: '✓',
      className: this.CSS_CLASSES.BADGE,
      ariaLabel: 'This product is low in FODMAPs and suitable for the diet',
    },
    MODERATE: {
      title: 'Moderate-FODMAP - Consume with caution',
      icon: '⚠',
      className: `${this.CSS_CLASSES.BADGE} ${this.CSS_CLASSES.BADGE_MODERATE}`,
      ariaLabel:
        'This product has moderate FODMAP content - consume in small portions',
    },
    HIGH: {
      title: 'High-FODMAP - Avoid',
      icon: '✗',
      className: `${this.CSS_CLASSES.BADGE} ${this.CSS_CLASSES.BADGE_HIGH}`,
      ariaLabel: 'This product is high in FODMAPs and should be avoided',
    },
    UNKNOWN: {
      title: 'FODMAP status unknown',
      icon: '?',
      className: `${this.CSS_CLASSES.BADGE} ${this.CSS_CLASSES.BADGE_UNKNOWN}`,
      ariaLabel: 'FODMAP status for this product is not yet determined',
    },
    PENDING: {
      title: 'Analyzing FODMAP content...',
      icon: '⋯',
      className: `${this.CSS_CLASSES.BADGE} ${this.CSS_CLASSES.BADGE_PENDING}`,
      ariaLabel: 'FODMAP classification is currently being processed',
    },
  }

  /**
   * Applies FODMAP styling and visibility to a product card element.
   * This is the main public method that coordinates all styling operations.
   *
   * @param card - The HTML element representing the product card
   * @param product - The product object with FODMAP status, explanation, and food type
   * @param shouldHide - Whether the card should be hidden from view
   */
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
      const hasBadge =
        card.querySelector(`.${StyleManager.CSS_CLASSES.BADGE}`) !== null
      const shouldShowBadge =
        StyleManager.STATUS_CONFIG[product.status] !== null

      // Skip if no changes needed
      if (
        currentStatus === product.status &&
        isCurrentlyHidden === shouldHide &&
        hasBadge === shouldShowBadge
      ) {
        return
      }

      StyleManager.resetCard(card)
      StyleManager.applyStatus(card, product.status, product.explanation)
      StyleManager.applyVisibility(card, shouldHide)

      card.dataset.fodmapStatus = product.status
      card.dataset.fodmapStyleApplied = 'true'
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
    // Remove all FODMAP-related classes
    card.classList.remove(
      StyleManager.CSS_CLASSES.LOW_HIGHLIGHT,
      StyleManager.CSS_CLASSES.HIGH_DIMMED,
      StyleManager.CSS_CLASSES.UNKNOWN_SUBTLE,
      StyleManager.CSS_CLASSES.PENDING_PROCESSING,
      StyleManager.CSS_CLASSES.CARD_HIDDEN,
    )

    // Find and remove the specific tooltip for this card's badge
    const badge = card.querySelector(`.${StyleManager.CSS_CLASSES.BADGE}`)
    if (badge) {
      const tooltipId = badge.getAttribute('data-tooltip-id')
      if (tooltipId) {
        const tooltip = document.getElementById(tooltipId)
        if (tooltip) {
          tooltip.remove()
        }
      }
    }

    // Remove badge from card
    badge?.remove()
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

    // Apply status-specific card styling
    switch (status) {
      case 'LOW':
        card.classList.add(StyleManager.CSS_CLASSES.LOW_HIGHLIGHT)
        break
      case 'MODERATE':
        card.classList.add(StyleManager.CSS_CLASSES.UNKNOWN_SUBTLE) // Use similar styling as UNKNOWN for now
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
        explanation,
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
   * The badge includes an icon, custom tooltip, and accessibility attributes.
   * Positioned absolutely in the top-right corner of the card.
   *
   * @param card - The parent HTML element to attach the badge to
   * @param title - Main status text
   * @param icon - Visual icon character (✓, ✗, ?, ⋯) displayed in the badge
   * @param className - CSS classes for styling the badge appearance
   * @param ariaLabel - Screen reader description for accessibility
   * @param explanation - Optional Serbian explanation of why product has this FODMAP status
   */
  private static addBadge(
    card: HTMLElement,
    title: string,
    icon: string,
    className: string,
    ariaLabel: string,
    explanation?: string,
  ): void {
    // Ensure card has relative positioning for badge positioning
    const computedStyle = window.getComputedStyle(card)
    if (computedStyle.position === 'static') {
      card.style.position = 'relative'
    }

    const badge = document.createElement('div')
    badge.className = className

    badge.innerHTML = icon
    badge.setAttribute('aria-label', ariaLabel)
    badge.setAttribute('role', 'img')

    // Always create custom tooltip for better UX
    const tooltip = StyleManager.createTooltip(title, explanation || '')
    // Append to document.body to avoid parent styling interference
    document.body.appendChild(tooltip)

    // Store tooltip ID on badge for proper cleanup
    badge.setAttribute('data-tooltip-id', tooltip.id)
    badge.setAttribute('data-has-tooltip', 'true')

    // Add hover events for custom tooltip
    StyleManager.addTooltipEvents(badge, tooltip)

    card.appendChild(badge)
  }

  /**
   * Creates a custom tooltip element with better styling than native tooltips
   */
  private static createTooltip(
    title: string,
    explanation: string,
  ): HTMLElement {
    const tooltip = document.createElement('div')
    const tooltipId = `fodmap-tooltip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    tooltip.className = StyleManager.CSS_CLASSES.TOOLTIP
    tooltip.id = tooltipId

    // Show only title if no explanation, otherwise show both
    if (explanation && explanation.trim()) {
      tooltip.innerHTML = `
        <div class="fodmap-tooltip-title">${title}</div>
        <div class="fodmap-tooltip-explanation">${explanation}</div>
      `
    } else {
      tooltip.innerHTML = `
        <div class="fodmap-tooltip-title">${title}</div>
      `
    }

    return tooltip
  }

  /**
   * Adds hover events to show/hide custom tooltip with smart positioning
   */
  private static addTooltipEvents(
    badge: HTMLElement,
    tooltip: HTMLElement,
  ): void {
    let hoverTimeout: number

    badge.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout)
      hoverTimeout = window.setTimeout(() => {
        // Smart positioning to avoid viewport edges
        StyleManager.positionTooltip(badge, tooltip)
        tooltip.classList.add(StyleManager.CSS_CLASSES.TOOLTIP_VISIBLE)
      }, 300) // Small delay to avoid flickering
    })

    badge.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout)
      tooltip.classList.remove(StyleManager.CSS_CLASSES.TOOLTIP_VISIBLE)
    })

    // Touch support for mobile
    badge.addEventListener('touchstart', (e) => {
      e.preventDefault()
      const isVisible = tooltip.classList.contains(
        StyleManager.CSS_CLASSES.TOOLTIP_VISIBLE,
      )
      if (isVisible) {
        tooltip.classList.remove(StyleManager.CSS_CLASSES.TOOLTIP_VISIBLE)
      } else {
        StyleManager.positionTooltip(badge, tooltip)
        tooltip.classList.add(StyleManager.CSS_CLASSES.TOOLTIP_VISIBLE)
      }
    })

    // Hide tooltip when clicking elsewhere
    const hideTooltip = (e: Event) => {
      if (
        !badge.contains(e.target as Node) &&
        !tooltip.contains(e.target as Node)
      ) {
        tooltip.classList.remove(StyleManager.CSS_CLASSES.TOOLTIP_VISIBLE)
      }
    }
    document.addEventListener('click', hideTooltip)

    // Store cleanup function reference for removal
    badge.setAttribute('data-cleanup-added', 'true')

    // Add cleanup when badge is removed from DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          if (node === badge) {
            document.removeEventListener('click', hideTooltip)
            tooltip.remove()
            observer.disconnect()
          }
        })
      })
    })

    // Observe the parent of the badge for removal
    if (badge.parentNode) {
      observer.observe(badge.parentNode, { childList: true })
    }
  }

  /**
   * Smart positioning for tooltip to avoid viewport edges
   */
  private static positionTooltip(
    badge: HTMLElement,
    tooltip: HTMLElement,
  ): void {
    const badgeRect = badge.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Reset positioning
    tooltip.style.top = ''
    tooltip.style.right = ''
    tooltip.style.left = ''
    tooltip.style.bottom = ''
    tooltip.classList.remove('fodmap-tooltip-below')

    // Use fixed positioning relative to viewport
    let top = badgeRect.top - 85
    let left = badgeRect.right - 290

    // Adjust if tooltip would go off the right edge
    if (badgeRect.right + 10 > viewportWidth) {
      left = badgeRect.left - 280 // Show to the left of badge
    }

    // Adjust if tooltip would go off the left edge
    if (left < 10) {
      left = 10 // Keep some margin from edge
    }

    // Adjust if tooltip would go off the top edge
    if (top < 10) {
      top = badgeRect.bottom + 10 // Show below badge instead
      tooltip.classList.add('fodmap-tooltip-below')
    }

    // Adjust if tooltip would go off the bottom edge
    if (top + 100 > viewportHeight) {
      top = badgeRect.top - 85 // Try above again
      if (top < 10) {
        top = viewportHeight - 110 // Last resort - near bottom
      }
    }

    tooltip.style.top = `${top}px`
    tooltip.style.left = `${left}px`
  }
}
