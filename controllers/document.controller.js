import { Document } from "../models/Document.js";
import { uploadToStorage } from "../services/storage.service.js";

export const uploadDocument = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "No file uploaded" });

    const fileUrl = await uploadToStorage(file.buffer, file.originalname, "documents");

    const doc = await Document.create({
      userId:    req.user._id,
      name:      req.body.name || file.originalname,
      type:      req.body.type,
      expiryDate: req.body.expiryDate || null,
      tags:      req.body.tags ? JSON.parse(req.body.tags) : [],
      fileUrl,
      fileName:  file.originalname,
      fileSize:  file.size,
    });

    res.status(201).json({ success: true, document: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDocuments = async (req, res) => {
  try {
    const { type, status } = req.query;
    const query = { userId: req.user._id };
    if (type)   query.type   = type;
    if (status) query.status = status;

    const docs = await Document.find(query).sort({ createdAt: -1 });
    res.json({ success: true, documents: docs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteDocument = async (req, res) => {
  try {
    await Document.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true, message: "Document deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
