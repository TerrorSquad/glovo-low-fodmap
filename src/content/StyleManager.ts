import { type FodmapStatus } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

/**
 * Handles styling for FODMAP indicators using Tailwind CSS classes
 */
export class StyleManager {
  static applyToCard(
    card: HTMLElement,
    status: FodmapStatus,
    shouldHide: boolean,
  ): void {
    PerformanceMonitor.measure('applyToCard', () => {
      try {
        const isHidden = card.style.display === 'none'
        const currentStatus = card.dataset.fodmapStatus

        if (currentStatus === status && isHidden === shouldHide) return

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
    })
  }

  private static resetCard(card: HTMLElement): void {
    card.classList.remove('fodmap-low-highlight')
    card.querySelector('.fodmap-badge')?.remove()
    card.style.position = 'relative'
  }

  private static applyStatus(card: HTMLElement, status: FodmapStatus): void {
    if (status === 'LOW') {
      card.classList.add('fodmap-low-highlight')
      StyleManager.addBadge(
        card,
        'Low-FODMAP',
        StyleManager.getCheckIcon(),
        'fodmap-badge',
      )
    } else if (status === 'HIGH') {
      StyleManager.addBadge(
        card,
        'High-FODMAP',
        StyleManager.getCrossIcon(),
        'fodmap-badge fodmap-badge-high',
      )
    }
  }

  private static applyVisibility(card: HTMLElement, shouldHide: boolean): void {
    card.style.display = shouldHide ? 'none' : 'block'
  }

  private static addBadge(
    card: HTMLElement,
    title: string,
    icon: string,
    className: string,
  ): void {
    const badge = document.createElement('div')
    badge.className = className
    badge.title = title
    badge.innerHTML = icon
    card.appendChild(badge)
  }

  private static getCheckIcon(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>`
  }

  private static getCrossIcon(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"/></svg>`
  }
}
