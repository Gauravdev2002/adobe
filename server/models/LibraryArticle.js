const mongoose = require("mongoose");

const libraryArticleSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        articleNumber: { type: String, required: true },
        section: { type: String, required: true },
        content: { type: String, required: true },
        tags: [{ type: String }]
    },
    { timestamps: true }
);

module.exports = mongoose.model("LibraryArticle", libraryArticleSchema);
