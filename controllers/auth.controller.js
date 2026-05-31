import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

const signAccess  = (id) => jwt.sign({ id }, process.env.JWT_SECRET,         { expiresIn: "15m" });
const signRefresh = (id) => jwt.sign({ id }, process.env.JWT_REFRESH_SECRET,  { expiresIn: "7d" });

const setCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken",  accessToken,  { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 15 * 60 * 1000 });
  res.cookie("refreshToken", refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 7 * 24 * 60 * 60 * 1000 });
};

export const register = async (req, res) => {
  try {
    const { name, email, password, companyName, phone } = req.body;
    if (await User.findOne({ email }))
      return res.status(409).json({ success: false, message: "Email already registered" });

    const user = await User.create({ name, email, password, companyName, phone });
    const accessToken  = signAccess(user._id);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    await user.save();

    setCookies(res, accessToken, refreshToken);
    res.status(201).json({ success: true, user: user.toSafeObject(), accessToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: "Invalid credentials" });

    const accessToken  = signAccess(user._id);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    await user.save();

    setCookies(res, accessToken, refreshToken);
    res.json({ success: true, user: user.toSafeObject(), accessToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ success: false, message: "No refresh token" });

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user    = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token)
      return res.status(401).json({ success: false, message: "Invalid refresh token" });

    const accessToken  = signAccess(user._id);
    const refreshToken = signRefresh(user._id);
    user.refreshToken  = refreshToken;
    await user.save();

    setCookies(res, accessToken, refreshToken);
    res.json({ success: true, accessToken });
  } catch (err) {
    res.status(401).json({ success: false, message: "Token expired or invalid" });
  }
};

export const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: null });
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getMe = (req, res) => res.json({ success: true, user: req.user });

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { $set: req.body }, { new: true }).select("-password -refreshToken");
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
