const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
    {
        clauseId: { type: mongoose.Schema.Types.ObjectId, ref: "Clause", required: true },
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", required: true },
        authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        text: { type: String, required: true }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
