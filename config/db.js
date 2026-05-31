import mongoose from "mongoose";

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to server/.env before starting the API.");
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB_NAME || "tender_ai",
      serverSelectionTimeoutMS: 8000,
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    throw new Error(`MongoDB connection error: ${err.message}`);
  }
};

export default connectDB;
