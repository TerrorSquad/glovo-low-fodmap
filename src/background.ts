// src/background.ts
import { db, type Product } from "./db";

// TODO: Implement API endpoint
const API_ENDPOINT = "https://tvoj-api.com/classify"; // OBAVEZNO ZAMENI
const ALARM_NAME = "classifyPendingProducts";

async function classifyPendingProducts() {
  try {
    const productsToClassify = await db.products
      .where("status")
      .equals("PENDING")
      .toArray();
    if (productsToClassify.length === 0) return;

    console.log(
      `[Background] Šaljem ${productsToClassify.length} proizvoda na API...`,
    );
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ products: productsToClassify }),
    });

    if (!response.ok) throw new Error(`API greška: ${response.statusText}`);
    const { results } = (await response.json()) as { results: Product[] };

    if (results && results.length > 0) {
      await db.products.bulkPut(results);
      console.log(
        `[Background] Ažurirano ${results.length} proizvoda iz API odgovora.`,
      );

      chrome.tabs.query({ url: "https://glovoapp.com/*" }, (tabs) => {
        tabs.forEach(
          (tab) =>
            tab.id &&
            chrome.tabs.sendMessage(tab.id, { action: "refreshStyles" }),
        );
      });
    }
  } catch (error) {
    console.error("[Background] Greška prilikom klasifikacije:", error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 15, delayInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) classifyPendingProducts();
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "newProductsFound") classifyPendingProducts();
});
