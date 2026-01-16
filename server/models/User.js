const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },
        role: {
            type: String,
            enum: ["lawyer", "client", "government"],
            required: true
        },
        phone: { type: String, default: "" },
        organization: { type: String, default: "" },
        designation: { type: String, default: "" },
        otpEnabled: { type: Boolean, default: false },
        bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "LibraryArticle" }]
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
