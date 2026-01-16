const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const OtpCode = require("../models/OtpCode");
const { logAudit } = require("../services/audit");
const { sendOtp } = require("../services/notifications");

const router = express.Router();

const issueToken = user =>
    jwt.sign(
        { id: user.id, role: user.role, name: user.name, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );

const generateOtp = () => String(crypto.randomInt(100000, 999999));

const storeOtp = async (userId, otp) => {
    const codeHash = await bcrypt.hash(otp, 10);
    const minutes = Number(process.env.OTP_EXPIRES_MIN || 10);
    const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

    await OtpCode.deleteMany({ userId });
    await OtpCode.create({ userId, codeHash, expiresAt });
};

const verifyOtp = async (userId, otp) => {
    const record = await OtpCode.findOne({ userId });
    if (!record || record.expiresAt < new Date()) {
        return false;
    }
    const matches = await bcrypt.compare(otp, record.codeHash);
    if (matches) {
        await OtpCode.deleteMany({ userId });
    }
    return matches;
};

router.post("/signup", async (req, res, next) => {
    try {
        const { name, email, password, role, organization, designation, otpEnabled, phone } = req.body;
        if (!name || !email || !password || !role) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const allowedRoles = ["lawyer", "client", "government"];
        if (!allowedRoles.includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existing = await User.findOne({ email: normalizedEmail });
        if (existing) {
            return res.status(409).json({ error: "User already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await User.create({
            name,
            email: normalizedEmail,
            passwordHash,
            role,
            phone: phone || "",
            organization: organization || "",
            designation: designation || "",
            otpEnabled: Boolean(otpEnabled)
        });

        await logAudit({
            actorId: user.id,
            actorRole: user.role,
            action: "USER_SIGNUP",
            entityType: "USER",
            entityId: user.id,
            metadata: { email: user.email }
        });

        if (user.otpEnabled) {
            const otp = generateOtp();
            await storeOtp(user.id, otp);
            const otpChannel = req.body.otpChannel === "sms" ? "sms" : "email";
            const destination = otpChannel === "sms" ? user.phone : user.email;
            if (otpChannel === "sms" && !destination) {
                return res.status(400).json({ error: "Phone number required for SMS OTP" });
            }
            await sendOtp({ channel: otpChannel, destination, otp });
            return res.status(201).json({
                message: "Signup successful. OTP required.",
                otpRequired: true,
                user: { id: user.id, name: user.name, role: user.role, email: user.email }
            });
        }

        const token = issueToken(user);
        return res.status(201).json({
            token,
            user: { id: user.id, name: user.name, role: user.role, email: user.email }
        });
    } catch (error) {
        return next(error);
    }
});

router.post("/login", async (req, res, next) => {
    try {
        const { email, password, otp, otpChannel } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        if (user.otpEnabled) {
            if (!otp) {
                const otpValue = generateOtp();
                await storeOtp(user.id, otpValue);
                const channel = otpChannel === "sms" ? "sms" : "email";
                const destination = channel === "sms" ? user.phone : user.email;
                if (channel === "sms" && !destination) {
                    return res.status(400).json({ error: "Phone number required for SMS OTP" });
                }
                await sendOtp({ channel, destination, otp: otpValue });
                return res.status(200).json({
                    otpRequired: true,
                    message: "OTP required for login"
                });
            }

            const otpOk = await verifyOtp(user.id, otp);
            if (!otpOk) {
                return res.status(401).json({ error: "Invalid OTP" });
            }
        }

        const token = issueToken(user);
        await logAudit({
            actorId: user.id,
            actorRole: user.role,
            action: "USER_LOGIN",
            entityType: "USER",
            entityId: user.id,
            metadata: { email: user.email }
        });

        return res.json({
            token,
            user: { id: user.id, name: user.name, role: user.role, email: user.email }
        });
    } catch (error) {
        return next(error);
    }
});

router.post("/otp/request", async (req, res, next) => {
    try {
        const { email, otpChannel } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user || !user.otpEnabled) {
            return res.status(404).json({ error: "OTP is not enabled for this user" });
        }
        const otpValue = generateOtp();
        await storeOtp(user.id, otpValue);
        const channel = otpChannel === "sms" ? "sms" : "email";
        const destination = channel === "sms" ? user.phone : user.email;
        if (channel === "sms" && !destination) {
            return res.status(400).json({ error: "Phone number required for SMS OTP" });
        }
        await sendOtp({ channel, destination, otp: otpValue });
        return res.json({ message: "OTP generated", otpRequired: true });
    } catch (error) {
        return next(error);
    }
});

router.post("/otp/verify", async (req, res, next) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required" });
        }
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const ok = await verifyOtp(user.id, otp);
        if (!ok) {
            return res.status(401).json({ error: "Invalid OTP" });
        }

        return res.json({ verified: true });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
