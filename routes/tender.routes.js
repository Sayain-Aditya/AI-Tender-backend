import { Router } from "express";
import {
  uploadTender, getTenders, getTender,
  updateTender, deleteTender, reanalyzeTender,
} from "../controllers/tender.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { uploadTender as multerTender } from "../middleware/upload.middleware.js";

const runUpload = (req, res) =>
  new Promise((resolve, reject) =>
    multerTender.single("file")(req, res, (err) => (err ? reject(err) : resolve()))
  );

const router = Router();
router.use(protect);
router.post("/upload", async (req, res, next) => {
  try { await runUpload(req, res); next(); }
  catch (e) { res.status(400).json({ success: false, message: e.message }); }
}, uploadTender);
router.get("/", getTenders);
router.get("/:id", getTender);
router.put("/:id", updateTender);
router.delete("/:id", deleteTender);
router.post("/:id/reanalyze", reanalyzeTender);
export default router;
