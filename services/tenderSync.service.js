import cron from "node-cron";
import { scrapeCPPP } from "./cpppScraper.service.js";
import { scrapeGeM } from "./gemScraper.service.js";
import { fetchAllGovDataTenders } from "./govDataApi.service.js";
import { DiscoveredTender } from "../models/DiscoveredTender.model.js";
import { SyncLog } from "../models/SyncLog.js";
import { Notification, User } from "../models/index.js";

const ROLLING_CPPP_KEYWORDS = ["civil", "road", "electrical", "water supply", "building", "infrastructure"];
const DEEP_CPPP_KEYWORDS = ["civil", "road", "electrical", "water", "infrastructure", "building", "railway", "defence", "it"];
const DEEP_GEM_KEYWORDS = ["civil", "electrical", "road", "goods", "services"];

let syncInProgress = false;

export const quickSyncGeM = async () => {
  const label = "GeM-Quick";
  const startedAt = Date.now();
  const lastSync = await getLastSyncTime("gem");
  console.log(`[${label}] Starting - last sync: ${lastSync?.toISOString() ?? "never"}`);

  try {
    const tenders = await scrapeGeM({ maxPages: 2 });
    const fresh = filterNewerThanLastSync(tenders, lastSync);
    const saved = await upsertTenders(fresh);

    await recordSync("gem", {
      scraped: tenders.length,
      saved,
      tier: 1,
      duration: Date.now() - startedAt,
    });

    if (saved > 0) {
      await notifyUsers(saved, "GeM");
      console.log(`[${label}] ${saved} new tenders saved`);
    } else {
      console.log(`[${label}] No new tenders`);
    }

    return { gem: tenders.length, saved, duplicates: Math.max(fresh.length - saved, 0), errors: [] };
  } catch (err) {
    await recordSync("gem", { error: err.message, tier: 1, duration: Date.now() - startedAt });
    console.error(`[${label}] Error:`, err.message);
    return { gem: 0, saved: 0, duplicates: 0, errors: [{ source: "gem", message: err.message }] };
  }
};

export const rollingSyncCPPP = async () => {
  const label = "CPPP-Rolling";
  const startedAt = Date.now();
  const lastSync = await getLastSyncTime("cppp");
  console.log(`[${label}] Starting - last sync: ${lastSync?.toISOString() ?? "never"}`);

  try {
    const allTenders = [];

    for (const keyword of ROLLING_CPPP_KEYWORDS) {
      const tenders = await scrapeCPPP({ keyword, maxPages: 1 });
      allTenders.push(...tenders);
      await sleep(1500);
    }

    const unique = deduplicateBatch(allTenders);
    const fresh = filterNewerThanLastSync(unique, lastSync);
    const saved = await upsertTenders(fresh);

    await recordSync("cppp", {
      scraped: allTenders.length,
      saved,
      tier: 2,
      duration: Date.now() - startedAt,
    });

    if (saved > 0) {
      await notifyUsers(saved, "CPPP");
      console.log(`[${label}] ${saved} new tenders saved`);
    } else {
      console.log(`[${label}] No new tenders`);
    }

    return { cppp: allTenders.length, saved, duplicates: Math.max(fresh.length - saved, 0), errors: [] };
  } catch (err) {
    await recordSync("cppp", { error: err.message, tier: 2, duration: Date.now() - startedAt });
    console.error(`[${label}] Error:`, err.message);
    return { cppp: 0, saved: 0, duplicates: 0, errors: [{ source: "cppp", message: err.message }] };
  }
};

export const fullDeepSync = async () => {
  const label = "FullDeepSync";
  const startedAt = Date.now();
  const stats = { cppp: 0, gem: 0, govdata: 0, saved: 0, duplicates: 0, errors: [] };

  console.log(`[${label}] Starting full sync - ${new Date().toISOString()}`);

  try {
    const cpppAll = [];
    for (const keyword of DEEP_CPPP_KEYWORDS) {
      const tenders = await scrapeCPPP({ keyword, maxPages: 5 });
      cpppAll.push(...tenders);
      await sleep(2000);
    }

    const unique = deduplicateBatch(cpppAll);
    const saved = await upsertTenders(unique);
    stats.cppp = cpppAll.length;
    stats.saved += saved;
    stats.duplicates += Math.max(unique.length - saved, 0);
  } catch (err) {
    stats.errors.push({ source: "cppp", message: err.message });
    console.error(`[${label}] CPPP error:`, err.message);
  }

  try {
    const gemAll = [];
    for (const search of DEEP_GEM_KEYWORDS) {
      const tenders = await scrapeGeM({ search, maxPages: 5 });
      gemAll.push(...tenders);
      await sleep(2000);
    }

    const unique = deduplicateBatch(gemAll);
    const saved = await upsertTenders(unique);
    stats.gem = gemAll.length;
    stats.saved += saved;
    stats.duplicates += Math.max(unique.length - saved, 0);
  } catch (err) {
    stats.errors.push({ source: "gem", message: err.message });
    console.error(`[${label}] GeM error:`, err.message);
  }

  try {
    const govData = await fetchAllGovDataTenders({ limit: 100 });
    const saved = await upsertTenders(govData);
    stats.govdata = govData.length;
    stats.saved += saved;
    stats.duplicates += Math.max(govData.length - saved, 0);
  } catch (err) {
    stats.errors.push({ source: "govdata", message: err.message });
    console.error(`[${label}] GovData error:`, err.message);
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const cleaned = await DiscoveredTender.deleteMany({ deadline: { $lt: cutoff } });

  await recordSync("all", {
    tier: 3,
    scraped: stats.cppp + stats.gem + stats.govdata,
    saved: stats.saved,
    cleaned: cleaned.deletedCount,
    error: stats.errors.map((err) => `${err.source}: ${err.message}`).join("; ") || undefined,
    duration: Date.now() - startedAt,
  });

  if (stats.saved > 0) await notifyUsers(stats.saved, "all portals");

  console.log(`[${label}] Done - stats:`, stats);
  return { ...stats, cleaned: cleaned.deletedCount };
};

export const syncTenders = async ({ sources = ["cppp", "gem", "govdata"] } = {}) => {
  if (syncInProgress) {
    return { skipped: true, reason: "Tender sync is already running" };
  }

  syncInProgress = true;
  try {
    if (sources.length === 1 && sources.includes("gem")) return quickSyncGeM();
    if (sources.length === 1 && sources.includes("cppp")) return rollingSyncCPPP();
    return fullDeepSync();
  } finally {
    syncInProgress = false;
  }
};

export const triggerManualSync = async (source = "all") => {
  if (source === "gem") return syncTenders({ sources: ["gem"] });
  if (source === "cppp") return syncTenders({ sources: ["cppp"] });
  if (source === "full" || source === "all") return syncTenders({ sources: ["cppp", "gem", "govdata"] });
  return syncTenders({ sources: [source] });
};

export const startTenderSyncJobs = () => {
  cron.schedule("*/30 * * * *", () => syncTenders({ sources: ["gem"] }), { timezone: "Asia/Kolkata" });
  cron.schedule("0 */2 * * *", () => syncTenders({ sources: ["cppp"] }), { timezone: "Asia/Kolkata" });
  cron.schedule("0 1 * * *", () => syncTenders({ sources: ["cppp", "gem", "govdata"] }), { timezone: "Asia/Kolkata" });
  cron.schedule("0 8 * * *", sendDeadlineReminders, { timezone: "Asia/Kolkata" });
  cron.schedule("0 0 * * *", refreshDocumentStatuses, { timezone: "Asia/Kolkata" });

  console.log(`[TenderSync] Cron jobs registered:
  - GeM quick sync: every 30 minutes
  - CPPP rolling sync: every 2 hours
  - Full deep sync: daily at 1:00 AM IST
  - Deadline alerts: daily at 8:00 AM IST
  - Document status refresh: daily at midnight IST`);
};

const upsertTenders = async (tenders) => {
  const validTenders = tenders.filter((tender) => tender?.title && tender?.source);
  if (!validTenders.length) return 0;

  const now = new Date();
  const ops = validTenders.map((tender) => ({
    updateOne: {
      filter: {
        $or: [
          ...(tender.tenderRef ? [{ tenderRef: tender.tenderRef, source: tender.source }] : []),
          { title: tender.title, source: tender.source, deadline: tender.deadline || null },
        ],
      },
      update: {
        $setOnInsert: { ...tender, createdAt: now },
        $set: { updatedAt: now },
      },
      upsert: true,
    },
  }));

  const result = await DiscoveredTender.bulkWrite(ops, { ordered: false });
  return result.upsertedCount || 0;
};

const deduplicateBatch = (tenders) => {
  const seen = new Set();
  return tenders.filter((tender) => {
    const key = tender.tenderRef || `${tender.title}__${tender.source}__${tender.deadline || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const filterNewerThanLastSync = (tenders, lastSync) => {
  if (!lastSync) return tenders;

  return tenders.filter((tender) => {
    const tenderDate = tender.publishedAt || tender.createdAt || tender.updatedAt;
    return !tenderDate || new Date(tenderDate) > lastSync;
  });
};

const getLastSyncTime = async (source) => {
  const log = await SyncLog.findOne({ source, error: { $exists: false } })
    .sort({ createdAt: -1 })
    .lean();
  return log?.createdAt ?? null;
};

const recordSync = async (source, meta) => {
  try {
    await SyncLog.create({ source, ...meta });
  } catch (err) {
    console.error("[TenderSync] Failed to write sync log:", err.message);
  }
};

const notifyUsers = async (count, sourceName) => {
  try {
    const users = await User.find({}, "_id").lean();
    if (!users.length) return;

    await Notification.insertMany(
      users.map((user) => ({
        userId: user._id,
        type: "system",
        title: `${count} New Tender${count > 1 ? "s" : ""} Found`,
        message: `${count} new tender${count > 1 ? "s" : ""} discovered from ${sourceName}. Check the Discover tab.`,
        read: false,
      })),
      { ordered: false }
    );

    console.log(`[TenderSync] Notified ${users.length} users`);
  } catch (err) {
    console.error("[TenderSync] Notification error:", err.message);
  }
};

const sendDeadlineReminders = async () => {
  const { Tender } = await import("../models/index.js");
  const { sendEmail } = await import("./notification.service.js");

  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tenders = await Tender.find({
    deadline: { $gte: new Date(), $lte: in7Days },
    status: { $in: ["Draft", "Under Review"] },
  })
    .select("title deadline uploadedBy")
    .populate("uploadedBy", "name email")
    .lean();

  for (const tender of tenders) {
    const user = tender.uploadedBy;
    if (!user?.email) continue;

    const days = Math.ceil((new Date(tender.deadline) - new Date()) / 86400000);

    await Notification.create({
      userId: user._id,
      type: "deadline",
      title: `Deadline in ${days} day${days !== 1 ? "s" : ""}`,
      message: `"${tender.title}" closes on ${new Date(tender.deadline).toDateString()}.`,
      refId: tender._id,
      refType: "Tender",
    });

    await sendEmail({
      to: user.email,
      subject: `Tender Deadline - ${tender.title}`,
      html: `<p>Hi ${user.name}, your tender <strong>${tender.title}</strong> closes in <strong>${days} days</strong> on ${new Date(tender.deadline).toDateString()}.</p>`,
    }).catch((err) => console.error("[Reminders] Email failed:", err.message));
  }

  console.log(`[Reminders] Sent ${tenders.length} deadline reminders`);
};

const refreshDocumentStatuses = async () => {
  const { Document } = await import("../models/index.js");
  const docs = await Document.find({ expiryDate: { $exists: true, $ne: null } });

  for (const doc of docs) {
    const diff = (doc.expiryDate - new Date()) / (1000 * 60 * 60 * 24);
    doc.status = diff < 0 ? "expired" : diff <= 30 ? "expiring" : "valid";
    await doc.save();
  }

  console.log(`[DocRefresh] Updated ${docs.length} document statuses`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
