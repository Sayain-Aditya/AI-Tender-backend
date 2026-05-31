import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { checkEligibility } from "../services/ai.service.js";
import { Tender } from "../models/Tender.js";

const router = Router();
router.use(protect);

// Check eligibility for a tender against current user's profile
router.post("/eligibility/:tenderId", async (req, res) => {
  try {
    const tender = await Tender.findOne({ _id: req.params.tenderId, uploadedBy: req.user._id });
    if (!tender) return res.status(404).json({ success: false, message: "Tender not found" });

    const result = await checkEligibility(tender.rawText || tender.summary, req.user.profile);
    tender.eligibility = result.score;
    await tender.save();

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
