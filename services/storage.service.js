// Stores file as a base64 data URL directly in MongoDB.
// No external storage service required.

export const uploadToStorage = async (buffer, filename, folder) => {
  const base64 = buffer.toString("base64");
  const ext = filename.split(".").pop().toLowerCase();
  const mime =
    ext === "pdf"  ? "application/pdf" :
    ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
    "text/plain";
  return `data:${mime};base64,${base64}`;
};

export const deleteFromStorage = async () => {
  // nothing to delete for base64 storage
};
