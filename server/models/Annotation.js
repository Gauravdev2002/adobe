const mongoose = require("mongoose");

const annotationSchema = new mongoose.Schema(
    {
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
        clauseId: { type: mongoose.Schema.Types.ObjectId, ref: "Clause", required: true },
        page: { type: Number, required: true },
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Annotation", annotationSchema);
