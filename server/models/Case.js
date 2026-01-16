const mongoose = require("mongoose");

const caseSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String, default: "" },
        status: { type: String, enum: ["ACTIVE", "ON_HOLD", "CLOSED"], default: "ACTIVE" },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        members: {
            lawyers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
            clients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
            government: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
        },
        documents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }]
    },
    { timestamps: true }
);

module.exports = mongoose.model("Case", caseSchema);
