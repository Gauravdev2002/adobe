const mongoose = require("mongoose");

const connectMongo = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
        throw new Error("MONGO_URI is required");
    }

    mongoose.set("strictQuery", true);
    await mongoose.connect(mongoUri, {
        dbName: process.env.MONGO_DB_NAME || "attorneycare"
    });
};

module.exports = { connectMongo };
