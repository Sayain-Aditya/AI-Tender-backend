import { DiscoveredTender } from "../models/DiscoveredTender.model.js";
import { Tender } from "../models/Tender.js";
import { syncTenders } from "../services/tenderSync.service.js";

const toPositiveInt = (value, fallback, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const buildDiscoverQuery = (queryParams = {}) => {
  const { source, category, search, deadlineAfter, deadlineBefore } = queryParams;
  const query = {};

  if (source && source !== "All") query.source = source;
  if (category && category !== "All") query.category = category;
  if (search) query.$text = { $search: search };

  query.deadline = { $gte: deadlineAfter ? new Date(deadlineAfter) : new Date() };
  if (deadlineBefore) query.deadline.$lte = new Date(deadlineBefore);

  return query;
};

export const getDiscoveredTenders = async (req, res) => {
  try {
    const page = toPositiveInt(req.query.page, 1, 10000);
    const limit = toPositiveInt(req.query.limit, 20, 100);
    const query = buildDiscoverQuery(req.query);
    const userId = String(req.user._id);

    const [tenders, total] = await Promise.all([
      DiscoveredTender.find(query)
        .sort(req.query.search ? { score: { $meta: "textScore" }, deadline: 1 } : { deadline: 1, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("title department tenderRef tenderValue emdAmount deadline category source sourceUrl aiAnalyzed aiSummary importedBy createdAt")
        .lean(),
      DiscoveredTender.countDocuments(query),
    ]);

    res.json({
      success: true,
      tenders: tenders.map((tender) => ({
        ...tender,
        importedBy: undefined,
        alreadyImported: tender.importedBy?.some((id) => String(id) === userId) || false,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const getDiscoverStats = async (req, res) => {
  try {
    const [{ stats = [], total = [] } = {}] = await DiscoveredTender.aggregate([
      { $match: { deadline: { $gte: new Date() } } },
      {
        $facet: {
          stats: [{ $group: { _id: "$source", count: { $sum: 1 } } }],
          total: [{ $count: "count" }],
        },
      },
    ]);

    res.json({ success: true, stats, total: total[0]?.count || 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const importTender = async (req, res) => {
  try {
    const discovered = await DiscoveredTender.findOneAndUpdate(
      { _id: req.params.id, importedBy: { $ne: req.user._id } },
      { $addToSet: { importedBy: req.user._id } },
      { new: false }
    ).lean();

    if (!discovered) {
      const exists = await DiscoveredTender.exists({ _id: req.params.id });
      return res.status(exists ? 409 : 404).json({
        success: false,
        message: exists ? "Already imported" : "Tender not found",
      });
    }

    const tender = await Tender.create({
      uploadedBy: req.user._id,
      title: discovered.title,
      department: discovered.department,
      tenderValue: discovered.tenderValue,
      emdAmount: discovered.emdAmount,
      deadline: discovered.deadline,
      category: discovered.category,
      source: "discovered",
      fileUrl: discovered.sourceUrl,
      rawText: discovered.rawText,
      summary: discovered.aiSummary,
      status: "Draft",
      aiAnalyzed: discovered.aiAnalyzed,
      notes: `imported:${discovered._id}`,
    });

    res.status(201).json({ success: true, tender });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const triggerSync = async (req, res) => {
  try {
    syncTenders({ sources: req.body.sources || ["cppp", "gem", "govdata"] })
      .then((stats) => console.log("[Manual Sync] Complete:", stats))
      .catch((err) => console.error("[Manual Sync] Error:", err.message));

    res.json({ success: true, message: "Sync started in background" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
