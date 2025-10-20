require('dotenv').config();
const { SendMailClient } = require("zeptomail");

const url = "https://api.zeptomail.com/";
const token = process.env.ZEPTO_TOKEN;

const transporter = new SendMailClient({ url, token });

module.exports = transporter;
