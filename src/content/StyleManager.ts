import { type FodmapStatus } from '../shared/db'

/**
 * Handles CSS injection and styling for FODMAP indicators
 */
export class StyleManager {
  private static readonly STYLE_ID = 'fodmap-helper-styles'
  private static readonly CSS = `
    .fodmap-low-highlight {
      box-shadow: 0 0 7px 2px rgba(76, 175, 80, 0.55);
      border-radius: 16px;
      transition: all 0.2s ease-in-out;
    }
    .fodmap-badge {
      position: absolute;
      top: 5px;
      right: 5px;
      width: 22px;
      height: 22px;
      background-color: #28a745;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border: 1px solid white;
      cursor: help;
    }
    .fodmap-badge svg {
      width: 12px;
      height: 12px;
      fill: white;
    }
    .fodmap-badge-high {
      background-color: #dc3545 !important;
    }
  `

  static inject(): void {
    if (document.getElementById(StyleManager.STYLE_ID)) return

    const style = document.createElement('style')
    style.id = StyleManager.STYLE_ID
    style.textContent = StyleManager.CSS
    document.head.appendChild(style)
  }

  static applyToCard(
    card: HTMLElement,
    status: FodmapStatus,
    shouldHide: boolean,
  ): void {
    const isHidden = card.style.display === 'none'
    const currentStatus = card.dataset.fodmapStatus

    if (currentStatus === status && isHidden === shouldHide) return

    StyleManager.resetCard(card)
    StyleManager.applyStatus(card, status)
    StyleManager.applyVisibility(card, shouldHide)

    card.dataset.fodmapStatus = status
    card.dataset.fodmapStyleApplied = 'true'
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
