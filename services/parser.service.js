import { createRequire } from "module";
import mammoth from "mammoth";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export const extractTextFromBuffer = async (buffer, mimetype) => {
  try {
    if (mimetype === "application/pdf") {
      const data = await pdfParse(buffer);
      return data.text?.trim() || "";
    }
    if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer });
      return result.value?.trim() || "";
    }
    if (mimetype === "text/plain") {
      return buffer.toString("utf-8").trim();
    }
    return "";
  } catch (err) {
    console.error("Text extraction error:", err.message);
    return "";
  }
};
