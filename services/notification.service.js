import nodemailer from "nodemailer";
import { Notification } from "../models/Notification.js";

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export const createNotification = async ({ userId, type, title, message, refId, refType }) => {
  return Notification.create({ userId, type, title, message, refId, refType });
};

export const sendEmail = async ({ to, subject, html }) => {
  await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, html });
};

export const sendDeadlineReminders = async () => {
  const { Tender, User } = await import("../models/Tender.js");
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const tenders = await Tender.find({
    deadline: { $gte: new Date(), $lte: soon },
    status:   { $in: ["Draft", "Under Review"] },
  }).populate("uploadedBy");

  for (const t of tenders) {
    const user = t.uploadedBy;
    const days = Math.ceil((new Date(t.deadline) - new Date()) / 86400000);

    await createNotification({
      userId:  user._id,
      type:    "deadline",
      title:   `Deadline in ${days} day${days !== 1 ? "s" : ""}`,
      message: `Tender "${t.title}" deadline is on ${new Date(t.deadline).toDateString()}.`,
      refId:   t._id,
      refType: "Tender",
    });

    if (user.email) {
      await sendEmail({
        to:      user.email,
        subject: `⏰ Tender Deadline Reminder — ${t.title}`,
        html:    `<h2>Deadline Reminder</h2><p>Your tender <strong>${t.title}</strong> deadline is in <strong>${days} days</strong> (${new Date(t.deadline).toDateString()}).</p><p>Log in to TenderAI to review and submit.</p>`,
      });
    }
  }
};
