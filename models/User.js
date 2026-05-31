import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  password:    { type: String, required: true, minlength: 6 },
  companyName: { type: String, required: true },
  phone:       { type: String },
  plan:        { type: String, enum: ["free", "pro", "enterprise"], default: "free" },
  profile: {
    turnover:           String,
    experience:         String,
    license:            String,
    gst:                String,
    iso:                String,
    completedProjects:  { type: Number, default: 0 },
    categories:         [String],
  },
  refreshToken: String,
}, { timestamps: true });

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

export const User = mongoose.model("User", userSchema);
