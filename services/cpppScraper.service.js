import { chromium } from "playwright";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const CPPP_URL = "https://eprocure.gov.in/epublish/app";

export const scrapeCPPP = async ({ maxPages = 1 } = {}) => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ userAgent: UA });
  const results = [];

  try {
    await page.goto(CPPP_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // table#activeTenders is on the homepage — confirmed working
    const tenders = await page.evaluate(() => {
      const table = document.getElementById("activeTenders");
      if (!table) return [];

      return [...table.querySelectorAll("tr")].map((row) => {
        const cells = [...row.querySelectorAll("td")];
        if (cells.length < 3) return null;

        const titleEl   = row.querySelector("a");
        const fullTitle = titleEl?.title || titleEl?.innerText?.trim() || cells[0]?.innerText?.trim() || "";
        const ref       = cells[1]?.innerText?.trim() || "";
        const deadline  = cells[2]?.innerText?.trim() || "";
        const href      = titleEl?.href || "";

        if (!fullTitle) return null;

        // Strip leading number "1. Title" → "Title"
        const title = fullTitle.replace(/^\d+\.\s*/, "").trim();

        return { title, tenderRef: ref.split("\n")[0].trim(), deadline, sourceUrl: href };
      }).filter(Boolean);
    });

    results.push(...tenders);
    console.log(`[CPPP Scraper] Got ${results.length} tenders from homepage`);
  } catch (err) {
    console.error("[CPPP Scraper] Error:", err.message);
  } finally {
    await browser.close();
  }

  return normalizeCPPP(results);
};

const normalizeCPPP = (raw) =>
  raw.filter((t) => t.title?.length > 3).map((t) => ({
    title:       t.title,
    department:  "Central Government",
    tenderRef:   t.tenderRef || "",
    tenderValue: "",
    emdAmount:   "",
    deadline:    parseDeadline(t.deadline),
    category:    mapCategory(t.title),
    source:      "CPPP",
    sourceUrl:   t.sourceUrl || CPPP_URL,
    rawText:     "",
    aiAnalyzed:  false,
  }));

const parseDeadline = (str = "") => {
  if (!str) return null;
  // Format: "23-Jun-2026 04:00 PM"
  const m = str.match(/(\d{2})-([A-Za-z]{3})-(\d{4})/);
  if (!m) return null;
  const d = new Date(`${m[2]} ${m[1]} ${m[3]}`);
  return isNaN(d.getTime()) ? null : d;
};

const CATEGORY_MAP = {
  civil: "Civil", road: "Civil", construction: "Civil", building: "Civil",
  electrical: "Electrical", electric: "Electrical", power: "Electrical",
  water: "Infrastructure", infrastructure: "Infrastructure", sewage: "Infrastructure",
  it: "IT", software: "IT", computer: "IT",
  supply: "Material", material: "Material", goods: "Material",
  service: "Services", maintenance: "Services", hiring: "Services",
};

const mapCategory = (raw = "") => {
  const key = raw.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_MAP)) {
    if (key.includes(k)) return v;
  }
  return "Other";
};
