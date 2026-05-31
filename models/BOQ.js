import mongoose from "mongoose";

const boqItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  category:    { type: String, enum: ["Civil", "Material", "Finishing", "Electrical", "Other"], default: "Civil" },
  unit:        { type: String, required: true },
  qty:         { type: Number, required: true, min: 0.001 },
  rate:        { type: Number, default: 0, min: 0 },
  amount:      { type: Number },
}, { _id: true });

const boqSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  tenderId:    { type: mongoose.Schema.Types.ObjectId, ref: "Tender" },
  title:       { type: String, default: "BOQ Draft" },
  items:       [boqItemSchema],
  overhead:    { type: Number, default: 8 },
  contingency: { type: Number, default: 3 },
  markup:      { type: Number, default: 15 },
  gst:         { type: Number, default: 18 },
  transport:   { type: Number, default: 0 },
  labor:       { type: Number, default: 0 },
  baseCost:    { type: Number, default: 0 },
  overheadAmount:    { type: Number, default: 0 },
  contingencyAmount: { type: Number, default: 0 },
  markupAmount:      { type: Number, default: 0 },
  gstAmount:         { type: Number, default: 0 },
  subtotal:          { type: Number, default: 0 },
  beforeGST:         { type: Number, default: 0 },
  totalBid:    { type: Number, default: 0 },
  profitPct:   { type: Number, default: 0 },
  aiInsight:   { type: String },
  status:      { type: String, enum: ["draft", "final"], default: "draft" },
  sourceFile: {
    fileName:    { type: String },
    mimetype:    { type: String },
    sourceType:  { type: String, enum: ["manual", "excel", "pdf"], default: "manual" },
    rawRowCount: { type: Number, default: 0 },
  },
}, { timestamps: true });

boqSchema.pre("save", async function () {
  this.items.forEach((item) => {
    item.amount = roundMoney(item.qty * item.rate);
  });

  const base = this.items.reduce((sum, item) => sum + item.amount, 0);
  const overheadAmount = base * (this.overhead || 0) / 100;
  const contingencyAmount = base * (this.contingency || 0) / 100;
  const subtotal = base + overheadAmount + contingencyAmount + (this.transport || 0) + (this.labor || 0);
  const markupAmount = subtotal * (this.markup || 0) / 100;
  const beforeGST = subtotal + markupAmount;
  const gstAmount = beforeGST * (this.gst || 0) / 100;
  const totalBid = beforeGST + gstAmount;

  this.baseCost = roundMoney(base);
  this.overheadAmount = roundMoney(overheadAmount);
  this.contingencyAmount = roundMoney(contingencyAmount);
  this.subtotal = roundMoney(subtotal);
  this.markupAmount = roundMoney(markupAmount);
  this.beforeGST = roundMoney(beforeGST);
  this.gstAmount = roundMoney(gstAmount);
  this.totalBid = roundMoney(totalBid);
  this.profitPct = this.totalBid > 0 ? roundMoney((this.markupAmount / this.totalBid) * 100) : 0;
});

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

export const BOQ = mongoose.model("BOQ", boqSchema);
