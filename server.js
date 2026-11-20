import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

// Basic CORS (apne frontend domain se replace karein)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-token");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change_this_admin_token";
const RECEIVER_LABEL = process.env.RECEIVER_LABEL || "StarWinn Direct Account";
const RECEIVER_UPI = process.env.RECEIVER_UPI || "";
const RECEIVER_BANK_INFO = process.env.RECEIVER_BANK_INFO || "";

const DATA_DIR = path.resolve("./data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

function loadStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) {
      return { users: {}, deposits: {} };
    }
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    return {
      users: raw.users && typeof raw.users === "object" ? raw.users : {},
      deposits: raw.deposits && typeof raw.deposits === "object" ? raw.deposits : {}
    };
  } catch {
    return { users: {}, deposits: {} };
  }
}

function saveStore(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = STORE_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmpFile, STORE_FILE);
}

const db = loadStore();

function ensureUser(uid) {
  const cleanUid = String(uid || "").trim();
  if (!db.users[cleanUid]) {
    db.users[cleanUid] = { uid: cleanUid, balance: 0, updatedAt: new Date().toISOString() };
  }
  return db.users[cleanUid];
}

function requireAdmin(req, res, next) {
  const token = String(req.headers["x-admin-token"] || "");
  const a = Buffer.from(token);
  const b = Buffer.from(ADMIN_TOKEN);
  if (!token || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, error: "Invalid admin token" });
  }
  next();
}

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "starwinn-payment-ledger" });
});

app.get("/api/payment-info", (req, res) => {
  res.json({
    ok: true,
    receiverLabel: RECEIVER_LABEL,
    upiId: RECEIVER_UPI,
    bankInfo: RECEIVER_BANK_INFO
  });
});

// 1. Create Deposit Order
app.post("/api/deposit/create", (req, res) => {
  const uid = String(req.body?.uid || "").trim();
  const amount = Number(req.body?.amount);

  if (!uid || !Number.isFinite(amount) || amount < 10 || amount > 500000) {
    return res.status(400).json({ ok: false, error: "Valid UID और सही अमाउंट (10 - 500000) दर्ज करें।" });
  }

  ensureUser(uid);
  const orderId = "SW_" + crypto.randomBytes(4).toString("hex").toUpperCase();

  const order = {
    orderId,
    uid,
    amount: Number(amount.toFixed(2)),
    utr: "",
    status: "awaiting_utr",
    createdAt: new Date().toISOString(),
    utrSubmittedAt: null,
    resolvedAt: null
  };

  db.deposits[orderId] = order;
  saveStore(db);

  return res.json({
    ok: true,
    order,
    payment: {
      receiverLabel: RECEIVER_LABEL,
      upiId: RECEIVER_UPI,
      bankInfo: RECEIVER_BANK_INFO
    }
  });
});

// 2. Submit UTR after payment
app.post("/api/deposit/submit-utr", (req, res) => {
  const orderId = String(req.body?.orderId || "").trim();
  const utr = String(req.body?.utr || "").trim();

  if (!orderId || utr.length < 6 || utr.length > 40) {
    return res.status(400).json({ ok: false, error: "सही Order ID और कम से कम 6 अंकों का UTR दर्ज करें।" });
  }

  const order = db.deposits[orderId];
  if (!order) {
    return res.status(404).json({ ok: false, error: "ऑर्डर नहीं मिला।" });
  }
  if (order.status === "credited") {
    return res.status(409).json({ ok: false, error: "यह ऑर्डर पहले ही क्रेडिट हो चुका है।" });
  }
  if (order.status === "rejected") {
    return res.status(409).json({ ok: false, error: "यह ऑर्डर रिजेक्ट हो चुका है।" });
  }

  const duplicate = Object.values(db.deposits).find(
    (d) => d.orderId !== orderId && d.utr === utr && d.status !== "rejected"
  );
  if (duplicate) {
    return res.status(409).json({ ok: false, error: "यह UTR पहले से किसी रिक्वेस्ट में इस्तेमाल हो चुका है।" });
  }

  order.utr = utr;
  order.status = "pending_approval";
  order.utrSubmittedAt = new Date().toISOString();
  saveStore(db);

  return res.json({ ok: true, order });
});

// 3. Admin: List deposits
app.get("/api/admin/deposits", requireAdmin, (req, res) => {
  const status = String(req.query?.status || "").trim();
  const list = Object.values(db.deposits)
    .filter((d) => !status || d.status === status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return res.json({ ok: true, deposits: list });
});

// 4. Admin: Approve & Credit Wallet (Once per order)
app.post("/api/admin/deposits/:orderId/approve", requireAdmin, (req, res) => {
  const orderId = String(req.params.orderId || "").trim();
  const order = db.deposits[orderId];

  if (!order) {
    return res.status(404).json({ ok: false, error: "ऑर्डर नहीं मिला।" });
  }
  if (order.status === "credited") {
    return res.status(409).json({ ok: false, error: "यह ऑर्डर पहले ही क्रेडिट हो चुका है।" });
  }
  if (!order.utr || order.status !== "pending_approval") {
    return res.status(400).json({ ok: false, error: "UTR सबमिट होने के बाद ही अप्रूव करें।" });
  }

  const user = ensureUser(order.uid);
  user.balance = Number((Number(user.balance || 0) + Number(order.amount)).toFixed(2));
  user.updatedAt = new Date().toISOString();

  order.status = "credited";
  order.resolvedAt = new Date().toISOString();
  saveStore(db);

  return res.json({
    ok: true,
    order,
    walletBalance: user.balance
  });
});

// 5. Admin: Reject Deposit
app.post("/api/admin/deposits/:orderId/reject", requireAdmin, (req, res) => {
  const orderId = String(req.params.orderId || "").trim();
  const order = db.deposits[orderId];

  if (!order) {
    return res.status(404).json({ ok: false, error: "ऑर्डर नहीं मिला।" });
  }
  if (order.status === "credited") {
    return res.status(409).json({ ok: false, error: "क्रेडिट हो चुके ऑर्डर को रिजेक्ट नहीं कर सकते।" });
  }

  order.status = "rejected";
  order.resolvedAt = new Date().toISOString();
  saveStore(db);

  return res.json({ ok: true, order });
});

// 5b. Admin: List all users & balances
app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = Object.values(db.users).sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );
  return res.json({ ok: true, users });
});

// 5c. Admin: Adjust user wallet balance
app.post("/api/admin/wallet/adjust", requireAdmin, (req, res) => {
  const uid = String(req.body?.uid || "").trim();
  const mode = String(req.body?.mode || "add").trim();
  const amount = Number(req.body?.amount);

  if (!uid || !Number.isFinite(amount) || amount < 0 || amount > 500000) {
    return res.status(400).json({ ok: false, error: "Valid UID और सही अमाउंट दर्ज करें।" });
  }

  const user = ensureUser(uid);
  const current = Number(user.balance || 0);
  let nextBalance = current;

  if (mode === "set") {
    nextBalance = amount;
  } else if (mode === "subtract") {
    nextBalance = current - amount;
  } else {
    nextBalance = current + amount;
  }

  if (nextBalance < 0) {
    return res.status(400).json({ ok: false, error: "बैलेंस 0 से कम नहीं हो सकता।" });
  }

  user.balance = Number(nextBalance.toFixed(2));
  user.updatedAt = new Date().toISOString();
  saveStore(db);

  return res.json({ ok: true, user, walletBalance: user.balance });
});

// 6. User Wallet & Deposit History
app.get("/api/wallet/:uid", (req, res) => {
  const uid = String(req.params.uid || "").trim();
  if (!uid) {
    return res.status(400).json({ ok: false, error: "UID ज़रूरी है।" });
  }
  const user = ensureUser(uid);
  const history = Object.values(db.deposits)
    .filter((d) => d.uid === uid)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return res.json({ ok: true, balance: user.balance, deposits: history });
});

app.listen(PORT, () => {
  console.log(`StarWinn backend running on port ${PORT}`);
});
