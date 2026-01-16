const nodemailer = require("nodemailer");
const twilio = require("twilio");

const buildEmailTransport = () => {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
        return null;
    }

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass }
    });
};

const getTwilioClient = () => {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
        return null;
    }
    return twilio(sid, token);
};

const sendOtpEmail = async (destination, otp) => {
    const transport = buildEmailTransport();
    const from = process.env.SMTP_FROM;
    if (!transport || !from) {
        if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.log(`[DEV] OTP for ${destination}: ${otp}`);
            return;
        }
        throw new Error("Email delivery is not configured");
    }

    await transport.sendMail({
        from,
        to: destination,
        subject: "AttorneyCare OTP Verification",
        text: `Your AttorneyCare OTP is ${otp}. It expires soon.`,
        html: `<p>Your AttorneyCare OTP is <strong>${otp}</strong>. It expires soon.</p>`
    });
};

const sendOtpSms = async (destination, otp) => {
    const client = getTwilioClient();
    const from = process.env.TWILIO_FROM;
    if (!client || !from) {
        if (process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.log(`[DEV] OTP for ${destination}: ${otp}`);
            return;
        }
        throw new Error("SMS delivery is not configured");
    }

    await client.messages.create({
        from,
        to: destination,
        body: `AttorneyCare OTP: ${otp}. It expires soon.`
    });
};

const sendOtp = async ({ channel, destination, otp }) => {
    if (!destination) {
        throw new Error("OTP destination is required");
    }

    if (channel === "sms") {
        return sendOtpSms(destination, otp);
    }

    return sendOtpEmail(destination, otp);
};

module.exports = { sendOtp };
