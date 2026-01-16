const mongoose = require("mongoose");

const clauseSchema = new mongoose.Schema(
    {
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
        index: { type: Number, required: true },
        text: { type: String, required: true },
        status: {
            type: String,
            enum: ["AGREED", "PENDING", "DISPUTED"],
            default: "PENDING"
        },
        disputeReason: { type: String, default: "" },
        reviewer: {
            name: { type: String, default: "" },
            designation: { type: String, default: "" },
            organization: { type: String, default: "" }
        },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Clause", clauseSchema);
