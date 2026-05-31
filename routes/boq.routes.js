import { Router } from "express";
import { createBOQ, importBOQ, getBOQs, getBOQ, updateBOQ, deleteBOQ, getAIInsight } from "../controllers/boq.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadBOQ } from "../middleware/upload.middleware.js";

const runUpload = (req, res) =>
  new Promise((resolve, reject) =>
    uploadBOQ.single("file")(req, res, (err) => (err ? reject(err) : resolve()))
  );

const router = Router();
router.use(protect);
router.post("/", createBOQ);
router.post("/import", async (req, res, next) => {
  try { await runUpload(req, res); next(); }
  catch (e) { res.status(400).json({ success: false, message: e.message }); }
}, importBOQ);
router.get("/", getBOQs);
router.get("/:id", getBOQ);
router.put("/:id", updateBOQ);
router.delete("/:id", deleteBOQ);
router.post("/:id/ai-insight", getAIInsight);
export default router;
