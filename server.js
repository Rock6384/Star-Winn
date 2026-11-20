import express from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const app = express();
app.use(express.json());

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
      return { users: {}, deposits: {}, withdrawals: {}, ledger: [] };
    }
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    return {
      users: raw.users && typeof raw.users === "object" ? raw.users : {},
      deposits: raw.deposits && typeof raw.deposits === "object" ? raw.deposits : {},
      withdrawals: raw.withdrawals && typeof raw.withdrawals === "object" ? raw.withdrawals : {},
      ledger: Array.isArray(raw.ledger) ? raw.ledger : []
    };
  } catch {
    return { users: {}, deposits: {}, withdrawals: {}, ledger: [] };
  }
}

function saveStore(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = STORE_FILE + ".tmp";
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmpFile, STORE_FILE);
}

const db = loadStore();

function pushLedger(entry) {
  db.ledger.unshift({
    id: "LED_" + crypto.randomBytes(4).toString("hex").toUpperCase(),
    createdAt: new Date().toISOString(),
    ...entry
  });
  if (db.ledger.length > 500) db.ledger.length = 500;
}

function ensureUser(uid, phone = "") {
  const cleanUid = String(uid || "").trim();
  const cleanPhone = String(phone || "").trim();
  if (!db.users[cleanUid]) {
    db.users[cleanUid] = {
      uid: cleanUid,
      phone: cleanPhone,
      balance: 0,
      blocked: false,
      blockReason: "",
      accountIssue: "",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
  } else if (cleanPhone && !db.users[cleanUid].phone) {
    db.users[cleanUid].phone = cleanPhone;
  }
  return db.users[cleanUid];
}

function findUserByQuery({ uid = "", phone = "" }) {
  const qUid = String(uid || "").trim();
  const qPhone = String(phone || "").trim();
  if (qUid && db.users[qUid]) return db.users[qUid];
  if (qPhone) {
    const matched = Object.values(db.users).find((u) => String(u.phone || "").trim() === qPhone);
    if (matched) return matched;
  }
  if (qUid) return ensureUser(qUid, qPhone);
  return null;
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

function buildUserFullReport(user) {
  const uid = user.uid;
  const userDeposits = Object.values(db.deposits)
    .filter((d) => d.uid === uid)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const userWithdrawals = Object.values(db.withdrawals)
    .filter((w) => w.uid === uid)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  const totalRechargeCredited = Number(
    userDeposits
      .filter((d) => d.status === "credited")
      .reduce((acc, d) => acc + Number(d.amount || 0), 0)
      .toFixed(2)
  );

  const pendingRechargeAmount = Number(
    userDeposits
      .filter((d) => d.status === "pending_approval" || d.status === "awaiting_utr")
      .reduce((acc, d) => acc + Number(d.amount || 0), 0)
      .toFixed(2)
  );

  const totalWithdrawalApproved = Number(
    userWithdrawals
      .filter((w) => w.status === "approved")
      .reduce((acc, w) => acc + Number(w.amount || 0), 0)
      .toFixed(2)
  );

  const pendingWithdrawalAmount = Number(
    userWithdrawals
      .filter((w) => w.status === "pending")
      .reduce((acc, w) => acc + Number(w.amount || 0), 0)
      .toFixed(2)
  );

  return {
    user,
    stats: {
      totalRechargeCredited,
      pendingRechargeAmount,
      totalWithdrawalApproved,
      pendingWithdrawalAmount,
      rechargeCount: userDeposits.length,
      withdrawalCount: userWithdrawals.length
    },
    deposits: userDeposits,
    withdrawals: userWithdrawals
  };
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

app.post("/api/user/sync", (req, res) => {
  const uid = String(req.body?.uid || "").trim();
  const phone = String(req.body?.phone || "").trim();
  if (!uid) {
    return res.status(400).json({ ok: false, error: "UID ज़रूरी है।" });
  }
  const user = ensureUser(uid, phone);
  saveStore(db);
  return res.json({
    ok: true,
    user,
    blocked: Boolean(user.blocked),
    blockReason: user.blockReason || "",
    accountIssue: user.accountIssue || ""
  });
});

app.post("/api/deposit/create", (req, res) => {
  const uid = String(req.body?.uid || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const amount = Number(req.body?.amount);

  if (!uid || !Number.isFinite(amount) || amount < 10 || amount > 500000) {
    return res.status(400).json({ ok: false, error: "Valid UID और सही अमाउंट (10 - 500000) दर्ज करें।" });
  }

  const user = ensureUser(uid, phone);
  if (user.blocked) {
    return res.status(403).json({
      ok: false,
      error: user.blockReason ? `अकाउंट ब्लॉक है: ${user.blockReason}` : "यह अकाउंट ब्लॉक किया गया है।"
    });
  }

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
  const user = ensureUser(order.uid);
  if (user.blocked) {
    return res.status(403).json({
      ok: false,
      error: user.blockReason ? `अकाउंट ब्लॉक है: ${user.blockReason}` : "यह अकाउंट ब्लॉक किया गया है।"
    });
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

app.post("/api/withdraw/create", (req, res) => {
  const uid = String(req.body?.uid || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const amount = Number(req.body?.amount);
  const methodInfo = String(req.body?.methodInfo || req.body?.upiOrBank || "").trim();

  if (!uid || !Number.isFinite(amount) || amount < 50 || amount > 500000) {
    return res.status(400).json({ ok: false, error: "Valid UID और सही विड्रॉल अमाउंट दर्ज करें।" });
  }

  const user = ensureUser(uid, phone);
  if (user.blocked) {
    return res.status(403).json({
      ok: false,
      error: user.blockReason ? `अकाउंट ब्लॉक है: ${user.blockReason}` : "यह अकाउंट ब्लॉक किया गया है।"
    });
  }
  if (user.accountIssue) {
    return res.status(403).json({ ok: false, error: `अकाउंट इशू: ${user.accountIssue}` });
  }

  const currentBal = Number(user.balance || 0);
  if (currentBal < amount) {
    return res.status(400).json({ ok: false, error: "पर्याप्त वॉलेट बैलेंस नहीं है।" });
  }

  user.balance = Number((currentBal - amount).toFixed(2));
  user.updatedAt = new Date().toISOString();

  const withdrawId = "WD_" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const reqItem = {
    withdrawId,
    uid,
    phone: user.phone || phone || "",
    amount: Number(amount.toFixed(2)),
    methodInfo,
    status: "pending",
    remark: "",
    createdAt: new Date().toISOString(),
    resolvedAt: null
  };

  db.withdrawals[withdrawId] = reqItem;
  pushLedger({
    type: "withdraw_request",
    uid,
    amount: reqItem.amount,
    refId: withdrawId,
    note: "Withdrawal requested (balance held)"
  });
  saveStore(db);

  return res.json({ ok: true, withdrawal: reqItem, walletBalance: user.balance });
});

app.get("/api/admin/deposits", requireAdmin, (req, res) => {
  const status = String(req.query?.status || "").trim();
  const list = Object.values(db.deposits)
    .filter((d) => !status || d.status === status)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return res.json({ ok: true, deposits: list });
});

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

  pushLedger({
    type: "deposit_approved",
    uid: order.uid,
    amount: order.amount,
    refId: orderId,
    note: `UTR ${order.utr} approved`
  });
  saveStore(db);

  return res.json({
    ok: true,
    order,
    walletBalance: user.balance
  });
});

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

app.get("/api/admin/withdrawals", requireAdmin, (req, res) => {
  const status = String(req.query?.status || "").trim();
  const list = Object.values(db.withdrawals)
    .filter((w) => !status || w.status === status)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return res.json({ ok: true, withdrawals: list });
});

app.post("/api/admin/withdrawals/:withdrawId/:action", requireAdmin, (req, res) => {
  const withdrawId = String(req.params.withdrawId || "").trim();
  const action = String(req.params.action || "").trim();
  const remark = String(req.body?.remark || "").trim();
  const wd = db.withdrawals[withdrawId];

  if (!wd) {
    return res.status(404).json({ ok: false, error: "विड्रॉल रिक्वेस्ट नहीं मिली।" });
  }
  if (wd.status !== "pending") {
    return res.status(409).json({ ok: false, error: "यह रिक्वेस्ट पहले ही प्रोसेस हो चुकी है।" });
  }

  const user = ensureUser(wd.uid);
  if (action === "approve") {
    wd.status = "approved";
    wd.remark = remark || "Approved by admin";
    wd.resolvedAt = new Date().toISOString();
    pushLedger({
      type: "withdraw_approved",
      uid: wd.uid,
      amount: wd.amount,
      refId: withdrawId,
      note: wd.remark
    });
  } else if (action === "reject") {
    wd.status = "rejected";
    wd.remark = remark || "Rejected by admin (refunded)";
    wd.resolvedAt = new Date().toISOString();
    user.balance = Number((Number(user.balance || 0) + Number(wd.amount || 0)).toFixed(2));
    user.updatedAt = new Date().toISOString();
    pushLedger({
      type: "withdraw_rejected_refund",
      uid: wd.uid,
      amount: wd.amount,
      refId: withdrawId,
      note: wd.remark
    });
  } else {
    return res.status(400).json({ ok: false, error: "अमान्य एक्शन।" });
  }

  saveStore(db);
  return res.json({ ok: true, withdrawal: wd, walletBalance: user.balance });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = Object.values(db.users).sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );
  return res.json({ ok: true, users });
});

app.get("/api/admin/user-lookup", requireAdmin, (req, res) => {
  const uid = String(req.query?.uid || "").trim();
  const phone = String(req.query?.phone || "").trim();
  if (!uid && !phone) {
    return res.status(400).json({ ok: false, error: "UID या Mobile Number दर्ज करें।" });
  }
  const user = findUserByQuery({ uid, phone });
  if (!user) {
    return res.status(404).json({ ok: false, error: "यूज़र नहीं मिला।" });
  }
  return res.json({ ok: true, ...buildUserFullReport(user) });
});

app.post("/api/admin/users/moderate", requireAdmin, (req, res) => {
  const uid = String(req.body?.uid || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const blocked = typeof req.body?.blocked === "boolean" ? req.body.blocked : undefined;
  const blockReason = typeof req.body?.blockReason === "string" ? req.body.blockReason.trim() : undefined;
  const accountIssue = typeof req.body?.accountIssue === "string" ? req.body.accountIssue.trim() : undefined;

  if (!uid && !phone) {
    return res.status(400).json({ ok: false, error: "UID या Mobile Number ज़रूरी है।" });
  }

  const user = findUserByQuery({ uid, phone });
  if (!user) {
    return res.status(404).json({ ok: false, error: "यूज़र नहीं मिला।" });
  }

  if (phone) user.phone = phone;
  if (typeof blocked === "boolean") {
    user.blocked = blocked;
    if (!blocked) user.blockReason = "";
  }
  if (typeof blockReason === "string") {
    user.blockReason = blockReason;
  }
  if (typeof accountIssue === "string") {
    user.accountIssue = accountIssue;
  }
  user.updatedAt = new Date().toISOString();

  pushLedger({
    type: "user_moderation",
    uid: user.uid,
    amount: 0,
    refId: user.uid,
    note: `blocked=${Boolean(user.blocked)}, issue=${user.accountIssue || "none"}`
  });
  saveStore(db);

  return res.json({ ok: true, ...buildUserFullReport(user) });
});

app.post("/api/admin/wallet/adjust", requireAdmin, (req, res) => {
  const uid = String(req.body?.uid || "").trim();
  const phone = String(req.body?.phone || "").trim();
  const mode = String(req.body?.mode || "add").trim();
  const amount = Number(req.body?.amount);
  const note = String(req.body?.note || "").trim();

  if ((!uid && !phone) || !Number.isFinite(amount) || amount < 0 || amount > 500000) {
    return res.status(400).json({ ok: false, error: "Valid UID/Mobile और सही अमाउंट दर्ज करें।" });
  }

  const user = findUserByQuery({ uid, phone });
  if (!user) {
    return res.status(404).json({ ok: false, error: "यूज़र नहीं मिला।" });
  }

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

  pushLedger({
    type: mode === "bonus" ? "admin_bonus" : `wallet_${mode}`,
    uid: user.uid,
    amount: Number(amount.toFixed(2)),
    refId: user.uid,
    note: note || `Mode: ${mode}`
  });
  saveStore(db);

  return res.json({ ok: true, user, walletBalance: user.balance });
});

app.get("/api/wallet/:uid", (req, res) => {
  const uid = String(req.params.uid || "").trim();
  const phone = String(req.query?.phone || "").trim();
  if (!uid) {
    return res.status(400).json({ ok: false, error: "UID ज़रूरी है।" });
  }
  const user = ensureUser(uid, phone);
  const report = buildUserFullReport(user);

  return res.json({
    ok: true,
    balance: user.balance,
    blocked: Boolean(user.blocked),
    blockReason: user.blockReason || "",
    accountIssue: user.accountIssue || "",
    deposits: report.deposits,
    withdrawals: report.withdrawals,
    stats: report.stats
  });
});

app.listen(PORT, () => {
  console.log(`StarWinn backend running on port ${PORT}`);
});
