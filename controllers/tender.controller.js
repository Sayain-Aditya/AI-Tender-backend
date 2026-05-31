import { Tender } from "../models/Tender.js";
import { extractTextFromBuffer } from "../services/parser.service.js";
import { analyzeTender } from "../services/ai.service.js";

export const uploadTender = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No file uploaded" });

    console.log("[upload] file:", file.originalname, file.mimetype, file.size);

    // Extract text from PDF/DOCX/TXT
    const rawText = await extractTextFromBuffer(file.buffer, file.mimetype);
    console.log("[upload] extracted text length:", rawText.length);

    if (!rawText || rawText.length < 50)
      return res.status(400).json({ success: false, message: "Could not extract text. Make sure it is a valid PDF, DOCX, or TXT." });

    // AI analysis
    console.log("[upload] sending to AI...");
    const aiData = await analyzeTender(rawText);
    console.log("[upload] AI done:", aiData.title);

    // Save to MongoDB — no file storage needed
    const tender = await Tender.create({
      uploadedBy: req.user._id,
      source:     "upload",
      title:      aiData.title       || file.originalname,
      department: aiData.department  || "",
      tenderValue:aiData.tenderValue || "",
      emdAmount:  aiData.emdAmount   || "",
      deadline:   aiData.deadline    ? new Date(aiData.deadline) : null,
      category:   aiData.category    || "Other",
      summary:    aiData.summary     || "",
      eligibility:aiData.eligibility || 0,
      requirements: aiData.requirements || [],
      risks:      aiData.risks       || [],
      fileName:   file.originalname,
      rawText:    rawText.slice(0, 50000), // cap at 50k chars to stay well under 16MB
      aiAnalyzed: true,
      status:     "Draft",
    });

    res.status(201).json({ success: true, tender });
  } catch (err) {
    console.error("[upload] error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTenders = async (req, res) => {
  try {
    const { status, category, search, page = 1, limit = 20 } = req.query;
    const query = { uploadedBy: req.user._id };

    if (status)   query.status   = status;
    if (category) query.category = category;
    if (search)   query.$text    = { $search: search };

    const [tenders, total] = await Promise.all([
      Tender.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).select("-rawText"),
      Tender.countDocuments(query),
    ]);

    res.json({ success: true, tenders, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getTender = async (req, res) => {
  try {
    const tender = await Tender.findOne({ _id: req.params.id, uploadedBy: req.user._id });
    if (!tender) return res.status(404).json({ success: false, message: "Tender not found" });
    res.json({ success: true, tender });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateTender = async (req, res) => {
  try {
    const tender = await Tender.findOneAndUpdate(
      { _id: req.params.id, uploadedBy: req.user._id },
      { $set: req.body }, { new: true }
    );
    if (!tender) return res.status(404).json({ success: false, message: "Tender not found" });
    res.json({ success: true, tender });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteTender = async (req, res) => {
  try {
    const tender = await Tender.findOneAndDelete({ _id: req.params.id, uploadedBy: req.user._id });
    if (!tender) return res.status(404).json({ success: false, message: "Tender not found" });

    res.json({ success: true, message: "Tender deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const reanalyzeTender = async (req, res) => {
  try {
    const tender = await Tender.findOne({ _id: req.params.id, uploadedBy: req.user._id });
    if (!tender) return res.status(404).json({ success: false, message: "Tender not found" });

    const aiData = await analyzeTender(tender.rawText);
    Object.assign(tender, {
      title:       aiData.title       || tender.title,
      department:  aiData.department  || tender.department,
      tenderValue: aiData.tenderValue || tender.tenderValue,
      emdAmount:   aiData.emdAmount   || tender.emdAmount,
      deadline:    aiData.deadline    ? new Date(aiData.deadline) : tender.deadline,
      category:    aiData.category    || tender.category,
      summary:     aiData.summary     || tender.summary,
      eligibility: aiData.eligibility || tender.eligibility,
      requirements:aiData.requirements|| tender.requirements,
      risks:       aiData.risks       || tender.risks,
      aiAnalyzed:  true,
    });
    await tender.save();

    res.json({ success: true, tender });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
