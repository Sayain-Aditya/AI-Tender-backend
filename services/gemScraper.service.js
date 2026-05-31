const GEM_HOME = "https://bidplus.gem.gov.in/all-bids";
const GEM_API  = "https://bidplus.gem.gov.in/all-bids-data";
const ROWS     = 20;
const UA       = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function getSession() {
  const res  = await fetch(GEM_HOME, {
    headers: { "User-Agent": UA },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GeM session failed: HTTP ${res.status}`);

  const html = await res.text();
  const match = html.match(/csrf_bd_gem_nk['":\s]+([a-f0-9]{32})/i);
  const csrfToken = match?.[1] || "";
  const rawCookies = res.headers.getSetCookie?.() || [];
  const cookieStr  = rawCookies.map((c) => c.split(";")[0]).join("; ");
  return { csrfToken, cookieStr };
}

function buildPayload(pageNum, csrfToken, search = "") {
  const param = JSON.stringify({
    param:  { searchBid: search, searchType: "fullText" },
    filter: { bidStatusType: "ongoing_bids", byType: "all", highBidValue: "", byEndDate: { from: "", to: "" }, sort: "Bid-End-Date-Oldest" },
    start:  (pageNum - 1) * ROWS,
    rows:   ROWS,
  });
  return `payload=${encodeURIComponent(param)}&csrf_bd_gem_nk=${csrfToken}`;
}

export const scrapeGeM = async ({ search = "", maxPages = 3 } = {}) => {
  const { csrfToken, cookieStr } = await getSession();
  if (!csrfToken) throw new Error("Could not get GeM CSRF token");

  const all = [];

  for (let p = 1; p <= maxPages; p++) {
    const res = await fetch(GEM_API, {
      method: "POST",
      headers: {
        "Content-Type":     "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        "Referer":           GEM_HOME,
        "User-Agent":        UA,
        "Accept":            "application/json, text/javascript, */*; q=0.01",
        "Cookie":            cookieStr,
      },
      body: buildPayload(p, csrfToken, search),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) { console.error(`[GeM] Page ${p} failed: ${res.status}`); break; }

    const json = await res.json();
    const docs  = json?.response?.response?.docs || [];
    if (!docs.length) break;

    all.push(...docs);
    console.log(`[GeM Scraper] Page ${p}: ${docs.length} tenders`);
  }

  console.log(`[GeM Scraper] Total: ${all.length}`);
  return normalizeGeM(all);
};

const normalizeGeM = (docs) =>
  docs.map((doc) => {
    const bidNumber  = doc.b_bid_number_parent?.[0] || doc.b_bid_number?.[0] || doc.id;
    const category   = doc.bd_category_name?.[0]   || doc.b_category_name?.[0] || "";
    const ministry   = doc.ba_official_details_minName?.[0]  || "";
    const dept       = doc.ba_official_details_deptName?.[0] || "";
    const endDateRaw = doc.final_end_date_sort?.[0];
    const quantity   = doc.b_total_quantity?.[0];

    return {
      title:       category || `GeM Bid ${bidNumber}`,
      department:  [ministry, dept].filter(Boolean).join(" — ") || "Government of India",
      tenderRef:   bidNumber,
      tenderValue: "",
      emdAmount:   "",
      deadline:    endDateRaw ? new Date(endDateRaw) : null,
      category:    mapGeMCategory(category),
      source:      "GeM",
      sourceUrl:   `https://bidplus.gem.gov.in/bid-details/${doc.b_id_parent?.[0] || doc.b_id?.[0]}`,
      rawText:     quantity ? `Quantity: ${quantity}` : "",
      aiAnalyzed:  false,
    };
  });

const GEM_CATEGORY_MAP = {
  civil: "Civil", road: "Civil", construction: "Civil",
  electrical: "Electrical", electric: "Electrical", solar: "Electrical",
  water: "Infrastructure", pipe: "Infrastructure", infrastructure: "Infrastructure",
  it: "IT", software: "IT", computer: "IT", laptop: "IT",
  furniture: "Material", stationery: "Material", vehicle: "Material",
  service: "Services", medical: "Services",
};

const mapGeMCategory = (raw = "") => {
  const key = raw.toLowerCase();
  for (const [k, v] of Object.entries(GEM_CATEGORY_MAP)) {
    if (key.includes(k)) return v;
  }
  return "Other";
};
