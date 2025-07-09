const lowFodmapKeywords = [
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
  'sir',
  'gauda',
];

const highFodmapKeywords = [
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

function checkProduct(productElement: HTMLElement) {
  const productName = productElement.innerText.toLowerCase();

  const isHighFodmap = highFodmapKeywords.some((keyword) =>
    productName.includes(keyword)
  );
  const isLowFodmap = lowFodmapKeywords.some((keyword) =>
    productName.includes(keyword)
  );

  if (isHighFodmap) {
    return 'high';
  }
  if (isLowFodmap) {
    return 'low';
  }
  return 'unknown';
}

function processProducts(hideNonLowFodmap: boolean = false) {
  // Pronalazimo sve sekcije sa proizvodima na stranici
  const productSections =
    document.querySelectorAll<HTMLElement>('.grid__content');

  productSections.forEach((section) => {
    // TODO: Check if the selector has changed in Chrome DevTools!
    const productCards = Array.from(
      section.querySelectorAll<HTMLElement>('section[type="PRODUCT_TILE"')
    );
    debugger;
    productCards.forEach((card) => {
      const status = checkProduct(card);

      card.style.border = 'none';
      card.style.display = 'block';

      if (status === 'low') {
        card.style.border = '3px solid #4CAF50';
      } else if (status === 'high') {
        card.style.border = '3px solid #F44336';
        if (hideNonLowFodmap) {
          card.style.display = 'none';
        }
      } else {
        // unknown
        if (hideNonLowFodmap) {
          card.style.display = 'none';
        }
      }
    });
  });
}

let debounceTimeout: number;

// Funkcija koja će se pozivati kada se desi promena
const handleMutations = () => {
  // Debounce: Sačekaj 500ms nakon poslednje promene pre pokretanja
  clearTimeout(debounceTimeout);
  debounceTimeout = setTimeout(() => {
    console.log('🔍 Promena detektovana, pokrećem skeniranje proizvoda...');
    chrome.storage.sync.get('hideNonLowFodmap', (data) => {
      processProducts(data.hideNonLowFodmap);
    });
  }, 500);
};

// Funkcija za pokretanje observer-a
const startObserver = () => {
  // Ciljni element koji posmatramo. Ovo je glavni kontejner za proizvode.
  const targetNode = document.querySelector('.store__page__body');

  if (!targetNode) {
    console.warn(
      'Nije pronađen targetNode (.store__page__body) za MutationObserver.'
    );
    // Pokušaj ponovo za sekund, jer se elementi možda još učitavaju
    setTimeout(startObserver, 1000);
    return;
  }

  // Konfiguracija za observer: pratimo dodavanje/uklanjanje elemenata u podstablu
  const config: MutationObserverInit = { childList: true, subtree: true };

  // Kreiranje observer instance sa našom callback funkcijom
  const observer = new MutationObserver(handleMutations);

  // Početak posmatranja
  observer.observe(targetNode, config);
  console.log('✅ MutationObserver je aktivan i posmatra promene.');
};

// --- AŽURIRANI START SKRIPTE ---

// Osluškuj poruke iz popup-a ili background skripte za toggle
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'toggleHide') {
    processProducts(request.hide);
  }
});

// Inicijalno pokretanje kada se stranica prvi put učita
chrome.storage.sync.get('hideNonLowFodmap', (data) => {
  setTimeout(() => {
    processProducts(data.hideNonLowFodmap);
    startObserver(); // Pokreni observer nakon prvog skeniranja
  }, 2000);
});
