import { Router } from "express";
import { uploadDocument, getDocuments, deleteDocument } from "../controllers/document.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadDocument as multerDoc } from "../middleware/upload.middleware.js";

const runUpload = (req, res) =>
  new Promise((resolve, reject) =>
    multerDoc.single("file")(req, res, (err) => (err ? reject(err) : resolve()))
  );

const router = Router();
router.use(protect);
router.post("/upload", async (req, res, next) => {
  try { await runUpload(req, res); next(); }
  catch (e) { res.status(400).json({ success: false, message: e.message }); }
}, uploadDocument);
router.get("/", getDocuments);
router.delete("/:id", deleteDocument);
export default router;
