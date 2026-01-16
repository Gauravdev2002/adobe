const mongoose = require("mongoose");

const otpCodeSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        codeHash: { type: String, required: true },
        expiresAt: { type: Date, required: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("OtpCode", otpCodeSchema);
