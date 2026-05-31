import { BOQ } from "../models/BOQ.js";
import { getBOQInsight } from "../services/ai.service.js";
import { parseBOQFile } from "../services/boqParser.service.js";

export const createBOQ = async (req, res) => {
  try {
    const boq = await BOQ.create({ userId: req.user._id, ...req.body });
    res.status(201).json({ success: true, boq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const importBOQ = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    let parsed;
    try {
      parsed = await parseBOQFile(req.file);
    } catch (parseErr) {
      console.error("BOQ parse error:", parseErr.message);
      return res.status(422).json({ success: false, message: parseErr.message });
    }

    if (!parsed.items.length) {
      return res.status(422).json({
        success: false,
        message: "No BOQ line items could be detected. Please check the file columns or PDF table formatting.",
      });
    }

    if (!parsed.items.some((item) => item.rate > 0)) {
      return res.status(422).json({
        success: false,
        message: "BOQ items were detected, but no rate or amount values could be read. Please check the rate/amount columns in the file.",
      });
    }

    const boq = await BOQ.create({
      userId: req.user._id,
      tenderId: req.body.tenderId || undefined,
      title: req.body.title || parsed.title,
      items: parsed.items,
      overhead: toNumber(req.body.overhead, 8),
      contingency: toNumber(req.body.contingency, 3),
      markup: toNumber(req.body.markup, 15),
      gst: toNumber(req.body.gst, 18),
      transport: toNumber(req.body.transport, 0),
      labor: toNumber(req.body.labor, 0),
      sourceFile: {
        fileName: req.file.originalname,
        mimetype: req.file.mimetype,
        sourceType: parsed.sourceType,
        rawRowCount: parsed.rawRowCount,
      },
    });

    res.status(201).json({ success: true, boq, importedItems: parsed.items.length });
  } catch (err) {
    console.error("BOQ import error:", err.message, err.errors || "");
    res.status(500).json({ success: false, message: err.message });
  }
};

const toNumber = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const getBOQs = async (req, res) => {
  try {
    const boqs = await BOQ.find({ userId: req.user._id }).sort({ updatedAt: -1 }).populate("tenderId", "title");
    res.json({ success: true, boqs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getBOQ = async (req, res) => {
  try {
    const boq = await BOQ.findOne({ _id: req.params.id, userId: req.user._id }).populate("tenderId");
    if (!boq) return res.status(404).json({ success: false, message: "BOQ not found" });
    res.json({ success: true, boq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateBOQ = async (req, res) => {
  try {
    const boq = await BOQ.findOne({ _id: req.params.id, userId: req.user._id });
    if (!boq) return res.status(404).json({ success: false, message: "BOQ not found" });

    Object.assign(boq, req.body);
    await boq.save();

    res.json({ success: true, boq });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteBOQ = async (req, res) => {
  try {
    const boq = await BOQ.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!boq) return res.status(404).json({ success: false, message: "BOQ not found" });

    res.json({ success: true, message: "BOQ deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getAIInsight = async (req, res) => {
  try {
    const boq = await BOQ.findOne({ _id: req.params.id, userId: req.user._id });
    if (!boq) return res.status(404).json({ success: false, message: "BOQ not found" });

    const insight = await getBOQInsight(boq);
    boq.aiInsight = insight;
    await boq.save();

    res.json({ success: true, insight });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
