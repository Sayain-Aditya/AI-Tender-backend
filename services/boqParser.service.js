import { createRequire } from "module";
import { extractTextFromBuffer } from "./parser.service.js";
const require = createRequire(import.meta.url);
const xlsx = require("xlsx");

const EXCEL_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
]);

const COLUMN_ALIASES = {
  description: ["description", "item", "item description", "particulars", "work", "work description", "name", "details", "item name", "boq item"],
  unit: ["unit", "uom", "units", "unit of measurement"],
  qty: ["qty", "quantity", "nos", "no", "number", "quantity required", "estimated quantity"],
  rate: ["rate", "unit rate", "price", "basic rate", "quoted rate", "estimated rate", "rate in figures", "rate amount"],
  amount: ["amount", "total", "total amount", "value", "cost", "estimated cost", "total cost", "item amount", "line amount"],
};

export const parseBOQFile = async (file) => {
  if (!file) throw new Error("No BOQ file uploaded");

  if (EXCEL_TYPES.has(file.mimetype)) {
    return parseExcelBOQ(file.buffer, file.originalname);
  }

  if (file.mimetype === "application/pdf") {
    const text = await extractTextFromBuffer(file.buffer, file.mimetype);
    return parseTextBOQ(text, file.originalname);
  }

  throw new Error("Unsupported BOQ file type");
};

const parseExcelBOQ = (buffer, fileName) => {
  const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("Excel file does not contain any sheets");

  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const { headerIndex, columns } = findHeader(rows);
  const dataRows = rows.slice(headerIndex + 1);

  const items = dataRows
    .map((row) => normalizeRow({
      description: row[columns.description],
      unit: row[columns.unit],
      qty: row[columns.qty],
      rate: row[columns.rate],
      amount: row[columns.amount],
    }))
    .filter(Boolean);

  if (items.length && !items.some((item) => item.rate > 0)) {
    throw new Error("BOQ rows were detected, but no rate or amount values could be read. Please check the Excel rate/amount column headers.");
  }

  return {
    title: fileName?.replace(/\.[^.]+$/, "") || "Imported BOQ",
    items,
    sourceType: "excel",
    rawRowCount: rows.length,
  };
};

const parseTextBOQ = (text = "", fileName) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const items = lines
    .map(parseBOQLine)
    .filter(Boolean);

  return {
    title: fileName?.replace(/\.[^.]+$/, "") || "Imported BOQ",
    items,
    sourceType: "pdf",
    rawRowCount: lines.length,
  };
};

const findHeader = (rows) => {
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const normalized = rows[index].map((cell) => normalizeHeader(cell));
    const columns = {};

    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      columns[field] = normalized.findIndex((cell) => matchesHeader(cell, aliases));
    }

    if (columns.description >= 0 && columns.unit >= 0 && columns.qty >= 0 && (columns.rate >= 0 || columns.amount >= 0)) {
      return { headerIndex: index, columns };
    }
  }

  throw new Error("Could not identify BOQ columns. Expected description, unit, qty, and rate/amount columns.");
};

const normalizeHeader = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");

const matchesHeader = (cell, aliases) => {
  if (!cell) return false;
  return aliases.some((alias) => {
    const normalizedAlias = normalizeHeader(alias);
    return cell === normalizedAlias || cell.includes(normalizedAlias) || normalizedAlias.includes(cell);
  });
};

const normalizeRow = ({ description, unit, qty, rate, amount }) => {
  const cleanDescription = String(description || "").trim();
  const cleanUnit = String(unit || "").trim() || "Nos";
  const cleanQty = toNumber(qty);
  const cleanRate = toNumber(rate);
  const cleanAmount = toNumber(amount);

  if (!cleanDescription || cleanQty <= 0) return null;

  return {
    description: cleanDescription,
    category: inferCategory(cleanDescription),
    unit: cleanUnit,
    qty: cleanQty,
    rate: cleanRate || (cleanAmount && cleanQty ? cleanAmount / cleanQty : 0),
  };
};

const parseBOQLine = (line) => {
  const match = line.match(/^(.+?)\s+(cum|sqm|sq\.?m|rm|rmt|kg|mt|nos|no|each|lot|ls|m)\s+([\d,.]+)\s+([\d,.]+)(?:\s+([\d,.]+))?$/i);
  if (!match) return null;

  return normalizeRow({
    description: match[1],
    unit: match[2],
    qty: match[3],
    rate: match[4],
    amount: match[5],
  });
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
};

const inferCategory = (description = "") => {
  const key = description.toLowerCase();
  if (/(wire|cable|panel|electrical|light|switch)/.test(key)) return "Electrical";
  if (/(tile|paint|plaster|finish|flooring)/.test(key)) return "Finishing";
  if (/(cement|steel|aggregate|sand|brick|material)/.test(key)) return "Material";
  if (/(excavat|concrete|brickwork|road|drain|earthwork)/.test(key)) return "Civil";
  return "Other";
};
