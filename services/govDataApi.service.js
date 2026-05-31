const BASE_URL = "https://api.data.gov.in/resource";
const API_KEY  = process.env.DATA_GOV_IN_KEY;
const CATALOG_CACHE_MS = 6 * 60 * 60 * 1000;

let catalogCache = { expiresAt: 0, datasets: [] };

// Dynamically discover tender datasets from data.gov.in catalog
const discoverResourceIds = async () => {
  if (!API_KEY || API_KEY === "your_data_gov_in_key_here") return [];
  if (catalogCache.expiresAt > Date.now()) return catalogCache.datasets;

  try {
    const url  = `https://api.data.gov.in/catalog/list?api-key=${API_KEY}&q=tender&format=json&count=10`;
    const res  = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const datasets = (data?.catalogs || [])
      .filter((c) => c.identifier)
      .map((c) => ({ id: c.identifier, name: c.title }))
      .slice(0, 5);

    catalogCache = { expiresAt: Date.now() + CATALOG_CACHE_MS, datasets };
    return datasets;
  } catch (err) {
    console.error("[GovData] Catalog discovery failed:", err.message);
    return [];
  }
};

export const fetchAllGovDataTenders = async ({ limit = 50 } = {}) => {
  if (!API_KEY || API_KEY === "your_data_gov_in_key_here") {
    console.warn("[GovData API] DATA_GOV_IN_KEY not set — skipping");
    return [];
  }

  const datasets = await discoverResourceIds();
  if (!datasets.length) {
    console.warn("[GovData API] No datasets found");
    return [];
  }

  const results = await Promise.allSettled(
    datasets.map(({ id, name }) =>
      fetchResource(id, limit).then((r) => {
        console.log(`[GovData API] ${name}: ${r.length} records`);
        return r;
      })
    )
  );

  return results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value);
};

const fetchResource = async (resourceId, limit) => {
  try {
    const params = new URLSearchParams({ "api-key": API_KEY, format: "json", limit: String(limit) });
    const res  = await fetch(`${BASE_URL}/${resourceId}?${params}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (!data?.records?.length) return [];
    return normalizeRecords(data.records);
  } catch (err) {
    console.error(`[GovData API] Resource ${resourceId} failed:`, err.message);
    return [];
  }
};

const normalizeRecords = (records) =>
  records
    .filter((r) => {
      const title = r.tender_title || r.title || r.work_description || r.description || "";
      return title.length > 3;
    })
    .map((r) => ({
      title:       r.tender_title || r.title || r.work_description || r.description || "",
      department:  r.department || r.organisation || r.ministry || r.org_name || "Government",
      tenderRef:   r.tender_id || r.tender_no || r.nit_no || "",
      tenderValue: formatValue(r.estimated_cost || r.tender_value || ""),
      emdAmount:   formatValue(r.emd_amount || r.earnest_money || ""),
      deadline:    parseDate(r.bid_submission_date || r.closing_date || r.last_date || ""),
      category:    mapCategory(r.tender_category || r.work_category || r.category || ""),
      source:      "data.gov.in",
      sourceUrl:   r.url || "",
      rawText:     JSON.stringify(r),
      aiAnalyzed:  false,
    }));

const formatValue = (val) => {
  if (!val) return "";
  const num = String(val).replace(/[^0-9.]/g, "");
  return num ? "₹" + Number(num).toLocaleString("en-IN") : String(val);
};

const parseDate = (str = "") => {
  if (!str) return null;
  const parts = str.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (parts) {
    const d = new Date(`${parts[3]}-${parts[2]}-${parts[1]}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const CATEGORY_KEYWORDS = {
  civil: "Civil", road: "Civil", building: "Civil", construction: "Civil",
  electrical: "Electrical", power: "Electrical",
  water: "Infrastructure", sewage: "Infrastructure",
  it: "IT", software: "IT",
  goods: "Material", supply: "Material",
  service: "Services", consulting: "Services",
};

const mapCategory = (raw = "") => {
  const key = raw.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_KEYWORDS)) {
    if (key.includes(k)) return v;
  }
  return "Other";
};
