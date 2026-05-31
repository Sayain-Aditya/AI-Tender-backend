import multer from "multer";
import path from "path";

const ALLOWED_TYPES = {
  tender:   ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"],
  document: ["application/pdf", "image/jpeg", "image/png"],
  boq:      ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv"],
};

const storage = multer.memoryStorage(); // Store in memory → upload to S3/Cloudinary

const fileFilter = (allowedMimes) => (req, file, cb) => {
  if (allowedMimes.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`Invalid file type. Allowed: ${allowedMimes.join(", ")}`), false);
};

export const uploadTender = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter(ALLOWED_TYPES.tender),
});

export const uploadDocument = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_TYPES.document),
});

export const uploadBOQ = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter(ALLOWED_TYPES.boq),
});
