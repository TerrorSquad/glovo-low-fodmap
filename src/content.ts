import lowFodmapData from './data/lowFodmap.json';
import highFodmapData from './data/highFodmap.json';

// --- POMOĆNE FUNKCIJE I PRIPREMA PODATAKA ---

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/č|ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/đ/g, 'dj')
    .replace(/ž/g, 'z');
}
debugger;
const preparedLowFodmap = {
  keywords: Array.from(new Set(lowFodmapData.keywords.map(normalizeText))),
  synonyms: Object.fromEntries(
    Object.entries(lowFodmapData.synonyms).map(([k, v]) => [
      normalizeText(k),
      normalizeText(v),
    ])
  ),
};

const preparedHighFodmap = {
  keywords: Array.from(new Set(highFodmapData.keywords.map(normalizeText))),
  synonyms: Object.fromEntries(
    Object.entries(highFodmapData.synonyms).map(([k, v]) => [
      normalizeText(k),
      normalizeText(v),
    ])
  ),
};

const injectCss = (): void => {
  const styleId = 'fodmap-helper-styles';
  if (document.getElementById(styleId)) return;
  const css = `
    .fodmap-low-highlight {
      box-shadow: 0 0 8px 3px rgba(76, 175, 80, 0.6) !important;
      transform: scale(1.02);
      transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
    }
    .fodmap-badge {
      position: absolute; top: 8px; right: 8px; width: 24px; height: 24px;
      background-color: #28a745; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; z-index: 10;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: help;
    }
    .fodmap-badge svg { width: 14px; height: 14px; fill: white; }
  `;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
};

// --- GLAVNA LOGIKA ---

function checkProduct(
  productText: string,
  sectionText: string
): 'low' | 'high' | 'unknown' {
  const combinedText = normalizeText(`${sectionText} ${productText}`);
  const hasMatch = (data: typeof preparedHighFodmap) => {
    for (const keyword of data.keywords)
      if (combinedText.includes(keyword)) return true;
    for (const synonym in data.synonyms)
      if (
        combinedText.includes(synonym) &&
        data.keywords.has(data.synonyms[synonym])
      )
        return true;
    return false;
  };
  if (hasMatch(preparedHighFodmap)) return 'high';
  if (hasMatch(preparedLowFodmap)) return 'low';
  return 'unknown';
}

/**
 * Pametna funkcija koja prolazi kroz sve proizvode i menja samo one koje mora.
 */
function processProducts(hideNonLowFodmap: boolean): void {
  const allCards = document.querySelectorAll<HTMLElement>(
    'section[type="PRODUCT_TILE"]'
  );

  allCards.forEach((card) => {
    const sectionTitleEl = card
      .closest('.grid')
      ?.querySelector<HTMLElement>('.grid__title');
    const sectionText = sectionTitleEl ? sectionTitleEl.innerText : '';
    const currentStatus = checkProduct(card.innerText, sectionText);

    const lastStatus = card.dataset.fodmapStatus;
    const isHidden = card.style.display === 'none';
    const shouldBeHidden = currentStatus !== 'low' && hideNonLowFodmap;

    // KLJUČNA OPTIMIZACIJA: Ako je stanje već ispravno, ne diraj DOM.
    if (lastStatus === currentStatus && isHidden === shouldBeHidden) {
      return;
    }

    // Reset stilova pre primene
    card.classList.remove('fodmap-low-highlight');
    card.querySelector('.fodmap-badge')?.remove();
    card.style.position = 'relative'; // osiguraj da je uvek tu

    // Primeni stilove za LOW status
    if (currentStatus === 'low') {
      card.classList.add('fodmap-low-highlight');
      const badge = document.createElement('div');
      badge.className = 'fodmap-badge';
      badge.title = 'Low-FODMAP friendly';
      badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>`;
      card.appendChild(badge);
    }

    // Primeni sakrivanje/prikazivanje
    card.style.display = shouldBeHidden ? 'none' : 'block';

    // Sačuvaj novi status na kartici
    card.dataset.fodmapStatus = currentStatus;
  });
}

// --- OBSERVER I INICIJALIZACIJA ---

let debounceTimeout: number;

const debouncedProcess = () => {
  chrome.storage.sync.get({ hideNonLowFodmap: false }, (data) => {
    processProducts(!!data.hideNonLowFodmap);
  });
};

const handleMutations = (): void => {
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(debouncedProcess, 500);
};

const start = (): void => {
  injectCss();

  const targetNode = document.querySelector('.store__page__body');

  if (targetNode) {
    const observer = new MutationObserver(handleMutations);
    observer.observe(targetNode, { childList: true, subtree: true });

    // Inicijalno skeniranje
    handleMutations();
    console.log('✅ FODMAP Helper je aktivan (automatski mod).');
  } else {
    setTimeout(start, 500); // Probaj ponovo ako stranica još nije spremna
  }
};

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggleHide') {
    // Kada se promeni toggle, obriši statuse sa svih kartica da bi se ponovo obradile
    const allCards = document.querySelectorAll<HTMLElement>(
      'section[type="PRODUCT_TILE"]'
    );
    allCards.forEach((card) => delete card.dataset.fodmapStatus);
    // Odmah pokreni obradu
    processProducts(message.hide);
  }
});

start();
