import { Router } from "express";
import { register, login, logout, refresh, getMe, updateProfile } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = Router();
router.post("/register",        register);
router.post("/login",           login);
router.post("/logout",          protect, logout);
router.post("/refresh",         refresh);
router.get ("/me",              protect, getMe);
router.put ("/profile",         protect, updateProfile);
export default router;
