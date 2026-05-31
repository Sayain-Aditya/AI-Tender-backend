import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export const protect = async (req, res, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers.authorization?.replace("Bearer ", "");

    if (!token) return res.status(401).json({ success: false, message: "Not authenticated" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password -refreshToken");
    if (!req.user) return res.status(401).json({ success: false, message: "User not found" });

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

export const requirePro = (req, res, next) => {
  if (!["pro", "enterprise"].includes(req.user?.plan))
    return res.status(403).json({ success: false, message: "Pro plan required for this feature" });
  next();
};
