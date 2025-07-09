import lowFodmapData from './data/lowFodmap.json';
import highFodmapData from './data/highFodmap.json';

// --- POMOĆNE FUNKCIJE I PRIPREMA PODATAKA (BEZ IZMENA) ---

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/č|ć/g, 'c')
    .replace(/š/g, 's')
    .replace(/đ/g, 'dj')
    .replace(/ž/g, 'z');
}

const preparedLowFodmap = {
  keywords: new Set(lowFodmapData.keywords.map(normalizeText)),
  synonyms: Object.fromEntries(
    Object.entries(lowFodmapData.synonyms).map(([k, v]) => [
      normalizeText(k),
      normalizeText(v),
    ])
  ),
};

const preparedHighFodmap = {
  keywords: new Set(highFodmapData.keywords.map(normalizeText)),
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
    .fodmap-low-highlight { box-shadow: 0 0 8px 3px rgba(76, 175, 80, 0.6) !important; transform: scale(1.02); transition: all 0.2s ease-in-out; }
    .fodmap-badge { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; background-color: #28a745; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; box-shadow: 0 1px 3px rgba(0,0,0,0.3); cursor: help; }
    .fodmap-badge svg { width: 14px; height: 14px; fill: white; }
  `;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
};

// --- GLAVNA LOGIKA (BEZ IZMENA) ---

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
  if (hasMatch(combinedText, preparedHighFodmap)) return 'high';
  if (hasMatch(preparedLowFodmap)) return 'low';
  return 'unknown';
}

function processAllProducts(hideNonLowFodmap: boolean): void {
  const allCards = document.querySelectorAll<HTMLElement>(
    'section[type="PRODUCT_TILE"]:not([data-fodmap-processed])'
  );

  if (allCards.length > 0) {
    console.log(
      `FODMAP Helper: Pronađeno ${allCards.length} novih proizvoda za obradu.`
    );
  }

  allCards.forEach((card) => {
    card.style.position = 'relative';

    const sectionTitleEl = card
      .closest('.grid')
      ?.querySelector<HTMLElement>('.grid__title');
    const sectionText = sectionTitleEl ? sectionTitleEl.innerText : '';
    const status = checkProduct(card.innerText, sectionText);

    if (status === 'low') {
      card.classList.add('fodmap-low-highlight');
      const badge = document.createElement('div');
      badge.className = 'fodmap-badge';
      badge.title = 'Low-FODMAP friendly';
      badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>`;
      card.appendChild(badge);
    }

    // Sakrivanje se rešava globalno u drugoj funkciji
    if (status !== 'low' && hideNonLowFodmap) {
      card.style.display = 'none';
    } else {
      card.style.display = 'block';
    }

    card.dataset.fodmapProcessed = 'true';
  });
}

function applyHideShow(hideNonLowFodmap: boolean): void {
  const allProcessedCards = document.querySelectorAll<HTMLElement>(
    'section[type="PRODUCT_TILE"][data-fodmap-processed]'
  );
  allProcessedCards.forEach((card) => {
    const isLow = card.classList.contains('fodmap-low-highlight');
    if (!isLow && hideNonLowFodmap) {
      card.style.display = 'none';
    } else {
      card.style.display = 'block';
    }
  });
}

// --- `setInterval` I INICIJALIZACIJA ---

function start(): void {
  console.log('✅ FODMAP Helper je aktivan. Skeniranje na svake 2 sekunde.');
  injectCss();

  // Glavna petlja koja se izvršava periodično
  setInterval(() => {
    chrome.storage.sync.get({ hideNonLowFodmap: false }, (data) => {
      processAllProducts(!!data.hideNonLowFodmap);
    });
  }, 2000); // Skeniraj svake 2 sekunde
}

// Listener za poruke iz popup-a - sada samo primenjuje sakrivanje/prikazivanje
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggleHide') {
    applyHideShow(message.hide);
  }
});

// Započni ceo proces
start();
