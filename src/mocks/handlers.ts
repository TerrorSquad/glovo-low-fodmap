// src/mocks/handlers.ts
import { HttpResponse, http } from "msw";
import type { Product } from "../db";

const API_ENDPOINT = "https://tvoj-api.com/classify";

export const handlers = [
  http.post(API_ENDPOINT, async ({ request }) => {
    const { products } = (await request.json()) as { products: Product[] };
    console.log("[MSW] Presretnut zahtev sa proizvodima:", products);

    const results = products.map((p) => {
      const name = p.name.toLowerCase();
      if (
        name.includes("hleb") ||
        name.includes("pšenica") ||
        name.includes("jogurt")
      ) {
        return { ...p, status: "HIGH" };
      }
      if (
        name.includes("piletina") ||
        name.includes("pirinač") ||
        name.includes("krompir")
      ) {
        return { ...p, status: "LOW" };
      }
      return { ...p, status: "UNKNOWN" };
    });

    return HttpResponse.json({ results });
  }),
];
