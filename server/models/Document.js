const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true },
        filename: { type: String, required: true },
        mimeType: { type: String, required: true },
        storagePath: { type: String, required: true },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        version: { type: Number, default: 1 },
        parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
        access: {
            lawyers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
            clients: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
            government: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
        },
        readOnlyForClients: { type: Boolean, default: true },
        clientCommentingAllowed: { type: Boolean, default: false }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
