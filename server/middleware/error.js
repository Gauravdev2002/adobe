const notFound = (req, res) => {
    res.status(404).json({ error: "Route not found" });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({
        error: err.message || "Unexpected server error"
    });
};

module.exports = { notFound, errorHandler };
