// Lista ključnih reči (bez izmena)
const lowFodmapKeywords: string[] = [
  'piletina',
  'ćuretina',
  'junetina',
  'riba',
  'jaja',
  'pirinač',
  'riža',
  'krompir',
  'šargarepa',
  'mrkva',
  'krastavac',
  'paradajz',
  'paprika',
  'tikvica',
  'spanać',
  'blitva',
  'banana',
  'pomorandža',
  'borovnica',
  'jagoda',
  'kivi',
  'limun',
  'badem',
  'orah',
  'bez laktoze',
  'gauda',
];
const highFodmapKeywords: string[] = [
  'pšenica',
  'raž',
  'ječam',
  'hleb',
  'testenina',
  'luk',
  'beli luk',
  'crni luk',
  'pasulj',
  'grašak',
  'leblebija',
  'sočivo',
  'jabuka',
  'kruška',
  'mango',
  'med',
  'fruktozni sirup',
  'mleko',
  'jogurt',
  'sladoled',
];

// Funkcija za proveru (bez izmena)
function checkProduct(productElement: HTMLElement): 'low' | 'high' | 'unknown' {
  const productName = productElement.innerText.toLowerCase();
  console.log(`Proveravam proizvod: ${productName}`);
  const isHighFodmap = highFodmapKeywords.some((keyword) =>
    productName.includes(keyword)
  );
  const isLowFodmap = lowFodmapKeywords.some((keyword) =>
    productName.includes(keyword)
  );
  if (isHighFodmap) return 'high';
  if (isLowFodmap) return 'low';
  return 'unknown';
}

// Funkcija za dodavanje CSS-a (bez izmena)
const injectCss = () => {
  const styleId = 'fodmap-helper-styles';
  if (document.getElementById(styleId)) return;
  const css = `
    .fodmap-low-highlight {
      box-shadow: -8px -8px -2px -3px rgba(76, 175, 80, 0.6) !important;

      border: 2px solid #4CAF50 !important;
      }
    .fodmap-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      background-color: #28a745;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .fodmap-badge svg {
      width: 14px;
      height: 14px;
      fill: white;
    }
  `;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = css;
  document.head.appendChild(style);
};

// --- NOVI, EFIKASNIJI DEO ---

let currentHideState = false;

// Nova funkcija koja obrađuje SAMO JEDNU KARTICU
function processSingleCard(card: HTMLElement, hideNonLowFodmap: boolean): void {
  // Ako je kartica već obrađena, preskoči je
  if (card.dataset.fodmapProcessed === 'true') {
    return;
  }

  // Reset stilova za svaki slučaj
  card.classList.remove('fodmap-low-highlight');
  card.querySelector('.fodmap-badge')?.remove();
  card.style.position = 'relative';

  const status = checkProduct(card);
  card.style.display = 'block';

  if (status === 'low') {
    card.classList.add('fodmap-low-highlight');
    const badge = document.createElement('div');
    badge.className = 'fodmap-badge';
    badge.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/></svg>`;
    card.appendChild(badge);
  } else if ((status === 'high' || status === 'unknown') && hideNonLowFodmap) {
    card.style.display = 'none';
  }

  // Označi karticu kao obrađenu da se ne ponavlja
  card.dataset.fodmapProcessed = 'true';
}

// Pametni "callback" za observer
const handleMutations = (mutations: MutationRecord[]) => {
  for (const mutation of mutations) {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          // Traži kartice samo unutar novododatih elemenata
          const productCards = element.querySelectorAll<HTMLElement>(
            'section[type="PRODUCT_TILE"]'
          );
          productCards.forEach((card) =>
            processSingleCard(card, currentHideState)
          );
        }
      });
    }
  }
};

// Funkcija koja obrađuje sve proizvode odjednom (za promenu filtera)
function processAllProducts(hideNonLowFodmap: boolean): void {
  currentHideState = hideNonLowFodmap;
  const allCards = document.querySelectorAll<HTMLElement>(
    'section[type="PRODUCT_TILE"]'
  );
  allCards.forEach((card) => {
    // Resetuj status obrađenosti da bi se primenila nova pravila (sakrivanje/prikazivanje)
    delete card.dataset.fodmapProcessed;
    processSingleCard(card, hideNonLowFodmap);
  });
}

function startObserver(): void {
  injectCss();

  // Sačuvaj inicijalno stanje filtera
  chrome.storage.sync.get({ hideNonLowFodmap: false }, (data) => {
    currentHideState = !!data.hideNonLowFodmap;
    // Prvo, obradi sve što je već na stranici
    processAllProducts(currentHideState);
  });

  const targetNode = document.querySelector('.store__page__body');
  if (!targetNode) {
    console.warn(
      'FODMAP Helper: Target node .store__page__body not found. Retrying...'
    );
    setTimeout(startObserver, 1000);
    return;
  }

  const observer = new MutationObserver(handleMutations);
  observer.observe(targetNode, { childList: true, subtree: true });

  console.log('✅ FODMAP Helper Observer je aktivan i efikasan.');
}

// Listener za poruke iz popup-a
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'toggleHide') {
    processAllProducts(message.hide);
  }
});

// Sačekaj da se osnovni elementi stranice učitaju
setTimeout(startObserver, 500);
