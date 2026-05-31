import { Router } from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
  getDiscoveredTenders,
  getDiscoverStats,
  importTender,
  triggerSync,
} from "../controllers/discover.controller.js";

const router = Router();
router.use(protect);

router.get  ("/",           getDiscoveredTenders);
router.get  ("/stats",      getDiscoverStats);
router.post ("/sync",       triggerSync);
router.post ("/:id/import", importTender);

export default router;
