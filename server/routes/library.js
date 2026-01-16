const express = require("express");
const fs = require("fs");
const path = require("path");
const LibraryArticle = require("../models/LibraryArticle");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const seedLibraryIfEmpty = async () => {
    const count = await LibraryArticle.countDocuments();
    if (count > 0) {
        return;
    }
    const seedPath = path.resolve(__dirname, "../data/librarySeed.json");
    const seed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
    await LibraryArticle.insertMany(seed);
};

router.get("/articles", requireAuth, async (req, res, next) => {
    try {
        await seedLibraryIfEmpty();
        const { q } = req.query;
        const query = q
            ? {
                  $or: [
                      { title: { $regex: q, $options: "i" } },
                      { content: { $regex: q, $options: "i" } },
                      { articleNumber: { $regex: q, $options: "i" } },
                      { section: { $regex: q, $options: "i" } }
                  ]
              }
            : {};
        const articles = await LibraryArticle.find(query).sort({ articleNumber: 1 });
        return res.json(articles);
    } catch (error) {
        return next(error);
    }
});

router.get("/articles/:id", requireAuth, async (req, res, next) => {
    try {
        await seedLibraryIfEmpty();
        const article = await LibraryArticle.findById(req.params.id);
        if (!article) {
            return res.status(404).json({ error: "Article not found" });
        }
        return res.json(article);
    } catch (error) {
        return next(error);
    }
});

router.post("/bookmarks/:id", requireAuth, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (!user.bookmarks.includes(req.params.id)) {
            user.bookmarks.push(req.params.id);
            await user.save();
        }
        return res.json({ bookmarked: true });
    } catch (error) {
        return next(error);
    }
});

router.delete("/bookmarks/:id", requireAuth, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        user.bookmarks = user.bookmarks.filter(id => id.toString() !== req.params.id);
        await user.save();
        return res.json({ bookmarked: false });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
