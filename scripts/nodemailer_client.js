#!/usr/bin/env node
/**
 * TrustMesh Nodemailer Client for Gmail SMTP
 * Sends login notification emails directly via Gmail SMTP using Nodemailer.
 */
const nodemailer = require('nodemailer');
const fs = require('fs');

async function main() {
  try {
    const rawUser = process.env.GMAIL_USER || process.env.SMTP_USER || '';
    const rawPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD || '';
    const adminEmail = (process.env.ADMIN_EMAIL || process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@trustmesh.network').trim();

    const gmailUser = rawUser.trim();
    const gmailAppPassword = rawPass.replace(/\s+/g, '').trim();

    if (!gmailUser || !gmailAppPassword) {
      console.log(JSON.stringify({
        success: false,
        skipped: true,
        message: 'GMAIL_USER or GMAIL_APP_PASSWORD not set in environment.'
      }));
      process.exit(0);
    }

    // Read payload from arguments or STDIN
    let payload = {};
    if (process.argv[2]) {
      try {
        payload = JSON.parse(process.argv[2]);
      } catch {
        payload = {};
      }
    } else {
      try {
        const stdinData = fs.readFileSync(0, 'utf-8');
        if (stdinData.trim()) {
          payload = JSON.parse(stdinData);
        }
      } catch {
        payload = {};
      }
    }

    const recipient = (payload.to || adminEmail).trim();
    const subject = payload.subject || 'TrustMesh Login Notification';
    const html = payload.html || '<p>User login notification</p>';

    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);

    const transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: `"TrustMesh Security Alert" <${gmailUser}>`,
      to: recipient,
      subject: subject,
      html: html,
    });

    console.log(JSON.stringify({
      success: true,
      messageId: info.messageId,
      recipient: recipient
    }));
  } catch (err) {
    const rawMsg = err.message || String(err);
    const safeMsg = gmailAppPassword ? rawMsg.split(gmailAppPassword).join('***') : rawMsg;
    console.log(JSON.stringify({
      success: false,
      error: safeMsg
    }));
    process.exit(1);
  }
}

main();
