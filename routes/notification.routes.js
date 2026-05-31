import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import { Notification } from "../models/Notification.js";

const router = Router();
router.use(protect);

router.get("/", async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, notifications });
});

router.put("/:id/read", async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { read: true });
  res.json({ success: true });
});

router.put("/read-all", async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ success: true });
});

export default router;
