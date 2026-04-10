const express = require('express');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const session = require('express-session');

dotenv.config();

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'otp-redirect-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 600000 } // 10 minutes
}));

// ==================== CONFIG ====================
const REDIRECT_URL = process.env.REDIRECT_URL || 'https://example.com';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Routes
app.get('/', (req, res) => {
  res.render('index', { error: null });
});

app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.render('index', { error: 'Please enter a valid email address' });
  }

  const otp = generateOTP();
  req.session.otpData = {
    email,
    otp,
    expiry: Date.now() + 10 * 60 * 1000
  };

  const mailOptions = {
    from: `"OTP Redirect" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your One-Time Password (Valid 10 min)',
    html: `
      <h2 style="font-family: Arial;">Your OTP Code</h2>
      <p style="font-size: 36px; letter-spacing: 10px; font-weight: bold;">${otp}</p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't request this, please ignore the email.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.render('verify', { email, error: null });
  } catch (err) {
    console.error("Email error:", err);
    res.render('index', { error: 'Failed to send email. Check your .env settings and App Password.' });
  }
});

app.post('/verify', (req, res) => {
  const { otp } = req.body;
  const otpData = req.session.otpData;

  if (!otpData) {
    return res.render('verify', { email: '', error: 'Session expired. Please start over.' });
  }

  if (Date.now() > otpData.expiry) {
    delete req.session.otpData;
    return res.render('verify', { email: otpData.email, error: 'OTP expired. Request a new one.' });
  }

  if (otp === otpData.otp) {
    delete req.session.otpData;
    return res.redirect(REDIRECT_URL);
  } else {
    return res.render('verify', { email: otpData.email, error: 'Incorrect OTP. Try again.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});