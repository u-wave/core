'use strict';

const nodemailer = require('nodemailer');

async function sendEmail(emailAddress, options) {
  const smtpOptions = {
    host: 'localhost',
    port: 25,
    debug: true,
    tls: {
      rejectUnauthorized: false,
    },
  };

  const transporter = nodemailer.createTransport(options.mailTransport || smtpOptions);

  const mailOptions = { to: emailAddress, ...options.email };

  await transporter.sendMail(mailOptions);
}

module.exports = sendEmail;
