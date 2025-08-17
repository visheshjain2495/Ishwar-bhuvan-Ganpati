import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import fs from 'fs';
import session from 'express-session';
import cookieParser from 'cookie-parser';
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_KEY_B64, "base64").toString("utf-8")
);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cookieParser());
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // true if HTTPS
}));

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
  res.render('home'); // Renders home.ejs
});

app.get('/gallery', (req, res) => {
  res.render('gallery'); // Renders gallery.ejs
});

app.get('/contribute', (req, res) => {
  res.render('contribute'); // Renders contribute.ejs
});

app.get('/songs', (req, res) => {
  res.render('songs'); // Renders songs.ejs
});

app.get('/updates', (req, res) => {
  res.render('updates'); // Renders updates.ejs
});

app.get('/admin-login', (req, res) => {
  res.render('admin-login'); // A page with "Sign in with Google"
});

// Updated admin route to check login and render adminPanel.ejs
app.get('/admin', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin-login');
  res.render('adminPanel');
});

// New route to view contributions, renders viewContributions.ejs with checkboxes for read/unread
app.get('/admin/view-contributions', async (req, res) => {
  if (!req.session.admin) return res.redirect('/admin-login');

  const contributionsSnap = await db.collection('contributions').orderBy('timestamp', 'desc').get();
  const contributions = contributionsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  res.render('viewContributions', { contributions });
});

// New route to render addAdminEmail.ejs page
app.get('/admin/add-email-page', (req, res) => {
  if (!req.session.admin) return res.redirect('/admin-login');
  res.render('addAdminEmail');
});

app.post('/admin/mark-read', async (req, res) => {
  const { docId, read } = req.body;
  await db.collection('contributions').doc(docId).update({ read: read });
  res.json({ success: true });
});

app.post('/admin/add-email', async (req, res) => {
  const { email } = req.body;
  await db.collection('admins').doc(email).set({ addedAt: admin.firestore.FieldValue.serverTimestamp() });
  res.json({ success: true });
});

// POST route to handle contribution submissions
app.post('/submit-contribution', async (req, res) => {
  try {
    let { name, contact, day, time, amount } = req.body;

    if (!name || !contact || !day || !time || !amount) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Create a base doc ID from the user's name (replace spaces with underscores)
    let baseId = name.trim().replace(/\s+/g, '_');
    let docId = baseId;

    // Check if a document with this ID already exists
    let counter = 2;
    while (true) {
      const docRef = db.collection('contributions').doc(docId);
      const docSnap = await docRef.get();
      if (!docSnap.exists) break; // ID is unique
      docId = `${baseId}-${counter}`;
      counter++;
    }

    // Save the contribution with the determined doc ID
    await db.collection('contributions').doc(docId).set({
      name,
      contact,
      day,
      time,
      amount,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.status(200).json({ message: 'Contribution submitted successfully' });
  } catch (error) {
    console.error('Error submitting contribution:', error);
    res.status(500).json({ message: 'Failed to submit contribution' });
  }
});

app.post('/admin-login', async (req, res) => {
  const { idToken } = req.body;
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const email = decodedToken.email;

    const allowedEmails = ['visheshjaincodes@gmail.com', 'parthgandhi515@gmail.com'];

    // Check if email is in hardcoded allowed emails
    if (allowedEmails.includes(email)) {
      req.session.admin = email;
      return res.json({ success: true });
    }

    // Check if email exists in admins collection
    const adminSnap = await db.collection('admins').doc(email).get();
    if (!adminSnap.exists) return res.status(403).send('Unauthorized');

    req.session.admin = email;
    res.json({ success: true });
  } catch (err) {
    res.status(403).json({ error: 'Unauthorized' });
  }
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});