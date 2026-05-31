import mongoose from "mongoose";

/**
 * Separate collection for auto-discovered tenders from government portals.
 * Users can "import" a discovered tender into their own Tender collection.
 */
const discoveredTenderSchema = new mongoose.Schema(
  {
    title:        { type: String, required: true, trim: true },
    department:   { type: String, default: "" },
    tenderRef:    { type: String, default: "" },   // NIT/Bid ID from source portal
    tenderValue:  { type: String, default: "" },
    emdAmount:    { type: String, default: "" },
    deadline:     { type: Date, default: null },
    category: {
      type: String,
      enum: ["Civil", "Electrical", "Infrastructure", "Material", "IT", "Services", "Other"],
      default: "Other",
    },
    source: {
      type: String,
      enum: ["CPPP", "GeM", "data.gov.in", "State"],
      required: true,
    },
    sourceUrl:    { type: String, default: "" },
    rawText:      { type: String, default: "" },
    aiAnalyzed:   { type: Boolean, default: false },
    aiSummary:    { type: String, default: "" },
    importedBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // tracks who imported it
  },
  {
    timestamps: true,
  }
);

// Indexes for fast filtering
discoveredTenderSchema.index({ source: 1, deadline: 1 });
discoveredTenderSchema.index({ category: 1, deadline: 1 });
discoveredTenderSchema.index({ importedBy: 1 });
discoveredTenderSchema.index({ title: "text", department: "text" });
discoveredTenderSchema.index({ tenderRef: 1, source: 1 }, { unique: false, sparse: true });

export const DiscoveredTender = mongoose.model("DiscoveredTender", discoveredTenderSchema);
