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

function checkProduct(productElement: HTMLDivElement) {
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
  // TODO: Check if the selector has changed in Chrome DevTools!
  const productCards: NodeListOf<HTMLDivElement> = document.querySelectorAll(
    'div[data-test-id="product-tile"]'
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
}

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'toggleHide') {
    processProducts(request.hide);
  }
});

chrome.storage.sync.get(
  'hideNonLowFodmap',
  (data: { hideNonLowFodmap: boolean }) => {
    setTimeout(() => {
      processProducts(data.hideNonLowFodmap);
    }, 2000);
  }
);
