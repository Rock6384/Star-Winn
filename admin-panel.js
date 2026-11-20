// ======================================================
// STARWINN FULL SECRET ADMIN CONTROL SUITE + LIVE BACKEND
// ======================================================
(function initStarWinnLiveLedger() {
  const LIVE_API = "https://star-winn-server.onrender.com";
  const SECRET_HASH = "#admin987";
  let liveOrderId = "";
  let secretTapCount = 0;
  let secretTapTimer = null;
  let activeTab = "lookup";
  let depositFilter = "pending_approval";
  let withdrawFilter = "pending";
  let lastLookedUpUid = "";

  function getCurrentUid() {
    return (
      localStorage.getItem("star_active_uid") ||
      localStorage.getItem("star_uid") ||
      localStorage.getItem("sw_uid") ||
      ""
    ).trim();
  }

  function getCurrentPhone() {
    return (
      localStorage.getItem("star_active_phone") ||
      localStorage.getItem("star_phone") ||
      localStorage.getItem("sw_phone") ||
      ""
    ).trim();
  }

  function isSecretUnlocked() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const hash = (window.location.hash || "").trim();
      if (params.get("admin") === "1" || hash === SECRET_HASH) {
        sessionStorage.setItem("sw_secret_admin_open", "1");
        return true;
      }
      return sessionStorage.getItem("sw_secret_admin_open") === "1";
    } catch {
      return false;
    }
  }

  function getAdminToken() {
    const input = document.getElementById("swAdminTokenInput");
    const val =
      (input ? input.value : "").trim() ||
      sessionStorage.getItem("sw_live_admin_token") ||
      "";
    if (val) sessionStorage.setItem("sw_live_admin_token", val);
    return val;
  }

  function renderAdminSuite(targetCard) {
    if (!targetCard) return;
    const savedToken = sessionStorage.getItem("sw_live_admin_token") || "";

    targetCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-weight:700;font-size:14px;color:#fff;">🛡️ Admin Control Suite</div>
        <span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#0f766e;color:#ccfbf1;">Secret Live</span>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input id="swAdminTokenInput" type="password" value="${savedToken}" placeholder="Admin Token" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;" />
        <button type="button" onclick="swSuiteRefresh()" style="padding:8px 12px;border-radius:8px;border:none;background:#334155;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Refresh</button>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;">
        <button id="swTabLookup" type="button" onclick="swSuiteSwitchTab('lookup')" style="padding:7px 4px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">User & Wallet</button>
        <button id="swTabDeposits" type="button" onclick="swSuiteSwitchTab('deposits')" style="padding:7px 4px;border-radius:8px;border:none;background:#1e293b;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">Deposits</button>
        <button id="swTabWithdraws" type="button" onclick="swSuiteSwitchTab('withdraws')" style="padding:7px 4px;border-radius:8px;border:none;background:#1e293b;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">Withdraws</button>
        <button id="swTabUsers" type="button" onclick="swSuiteSwitchTab('users')" style="padding:7px 4px;border-radius:8px;border:none;background:#1e293b;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">All Users</button>
      </div>

      <!-- TAB 1: UID + Mobile Lookup, Add Money, Bonus, Block/Unblock, Issue -->
      <div id="swPaneLookup">
        <div style="border:1px solid rgba(148,163,184,0.22);border-radius:10px;padding:10px;background:rgba(15,23,42,0.65);margin-bottom:8px;">
          <div style="font-size:12px;font-weight:700;color:#e2e8f0;margin-bottom:6px;">🔍 User Lookup (UID या Mobile)</div>
          <input id="swLookupUid" type="text" placeholder="User UID (e.g. 15450611)" style="width:100%;padding:7px 9px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;margin-bottom:6px;box-sizing:border-box;" />
          <input id="swLookupPhone" type="text" placeholder="Mobile Number (e.g. 9876543210)" style="width:100%;padding:7px 9px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;margin-bottom:8px;box-sizing:border-box;" />
          <button type="button" onclick="swSuiteLookupUser()" style="width:100%;padding:7px;border-radius:8px;border:none;background:#0284c7;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Get Full User Report</button>
        </div>

        <div id="swUserReportBox" style="margin-bottom:8px;"></div>

        <div style="border:1px solid rgba(148,163,184,0.22);border-radius:10px;padding:10px;background:rgba(15,23,42,0.65);margin-bottom:8px;">
          <div style="font-size:12px;font-weight:700;color:#e2e8f0;margin-bottom:6px;">💰 Add Money / Bonus / Balance</div>
          <input id="swWalletAmount" type="number" placeholder="Amount (₹)" style="width:100%;padding:7px 9px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;margin-bottom:6px;box-sizing:border-box;" />
          <input id="swWalletNote" type="text" placeholder="Note / Reason (optional)" style="width:100%;padding:7px 9px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;margin-bottom:8px;box-sizing:border-box;" />
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">
            <button type="button" onclick="swSuiteAdjustWallet('add')" style="padding:7px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">+ Add Money</button>
            <button type="button" onclick="swSuiteAdjustWallet('bonus')" style="padding:7px;border-radius:8px;border:none;background:#7c3aed;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">🎁 Give Bonus</button>
            <button type="button" onclick="swSuiteAdjustWallet('set')" style="padding:7px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Set Balance</button>
            <button type="button" onclick="swSuiteAdjustWallet('subtract')" style="padding:7px;border-radius:8px;border:none;background:#dc2626;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">- Deduct</button>
          </div>
        </div>

        <div style="border:1px solid rgba(148,163,184,0.22);border-radius:10px;padding:10px;background:rgba(15,23,42,0.65);">
          <div style="font-size:12px;font-weight:700;color:#e2e8f0;margin-bottom:6px;">🚫 Account Block / Unblock & Issue</div>
          <input id="swBlockReason" type="text" placeholder="Block Reason (e.g. Suspicious activity)" style="width:100%;padding:7px 9px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;margin-bottom:6px;box-sizing:border-box;" />
          <input id="swAccountIssue" type="text" placeholder="Account Issue Message (khali chhodne par clear)" style="width:100%;padding:7px 9px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;margin-bottom:8px;box-sizing:border-box;" />
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
            <button type="button" onclick="swSuiteModerate(true)" style="padding:7px;border-radius:8px;border:none;background:#dc2626;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">Block</button>
            <button type="button" onclick="swSuiteModerate(false)" style="padding:7px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">Unblock</button>
            <button type="button" onclick="swSuiteModerate(undefined)" style="padding:7px;border-radius:8px;border:none;background:#d97706;color:#fff;font-size:11px;font-weight:600;cursor:pointer;">Save Issue</button>
          </div>
        </div>
      </div>

      <!-- TAB 2: Deposits & UTR -->
      <div id="swPaneDeposits" style="display:none;">
        <div style="display:flex;gap:8px;">
          <button type="button" onclick="swAdminFetchDeposits('pending_approval')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#0284c7;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Pending</button>
          <button type="button" onclick="swAdminFetchDeposits('')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#334155;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">All</button>
        </div>
        <div id="swAdminList"></div>
      </div>

      <!-- TAB 3: Withdrawals Approval -->
      <div id="swPaneWithdraws" style="display:none;">
        <div style="display:flex;gap:8px;">
          <button type="button" onclick="swAdminFetchWithdrawals('pending')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#0284c7;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Pending WD</button>
          <button type="button" onclick="swAdminFetchWithdrawals('')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#334155;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">All WD</button>
        </div>
        <div id="swWithdrawList"></div>
      </div>

      <!-- TAB 4: All Users -->
      <div id="swPaneUsers" style="display:none;">
        <div id="swAllUsersList"></div>
      </div>
    `;
  }

  function findAdminCard() {
    const existing = document.querySelector("[data-sw-secret-admin='1']");
    if (existing) return existing;

    const candidates = Array.from(document.querySelectorAll("div, section, article, aside"));
    for (const el of candidates) {
      const txt = (el.innerText || "").trim();
      const hasHeading =
        txt.includes("Admin UTR Approval") ||
        txt.includes("Full Admin Panel") ||
        txt.includes("Admin Control Dashboard") ||
        txt.includes("Admin Control Suite");
      if (!hasHeading) continue;
      if (txt.length > 0 && txt.length < 360 && el.querySelector("input, button")) {
        el.setAttribute("data-sw-secret-admin", "1");
        return el;
      }
    }
    return null;
  }

  function applySecretVisibility() {
    const targetCard = findAdminCard();
    if (!targetCard) return;

    if (isSecretUnlocked()) {
      targetCard.style.display = "";
      if (!targetCard.dataset.swRendered) {
        targetCard.dataset.swRendered = "1";
        renderAdminSuite(targetCard);
      }
    } else {
      targetCard.style.display = "none";
    }
  }

  window.swUnlockSecretAdmin = function () {
    sessionStorage.setItem("sw_secret_admin_open", "1");
    const targetCard = findAdminCard();
    if (targetCard) {
      targetCard.style.display = "";
      targetCard.dataset.swRendered = "1";
      renderAdminSuite(targetCard);
      if (typeof showToast === "function") showToast("🔓", "Admin Control Suite unlocked");
    }
  };

  window.swSuiteSwitchTab = function (tab) {
    activeTab = tab;
    const panes = {
      lookup: document.getElementById("swPaneLookup"),
      deposits: document.getElementById("swPaneDeposits"),
      withdraws: document.getElementById("swPaneWithdraws"),
      users: document.getElementById("swPaneUsers")
    };
    const btns = {
      lookup: document.getElementById("swTabLookup"),
      deposits: document.getElementById("swTabDeposits"),
      withdraws: document.getElementById("swTabWithdraws"),
      users: document.getElementById("swTabUsers")
    };

    Object.keys(panes).forEach((k) => {
      if (panes[k]) panes[k].style.display = k === tab ? "block" : "none";
      if (btns[k]) btns[k].style.background = k === tab ? "#2563eb" : "#1e293b";
    });

    if (tab === "deposits") swAdminFetchDeposits(depositFilter);
    else if (tab === "withdraws") swAdminFetchWithdrawals(withdrawFilter);
    else if (tab === "users") swAdminFetchUsers();
  };

  window.swSuiteRefresh = function () {
    if (activeTab === "lookup" && lastLookedUpUid) swSuiteLookupUser();
    else if (activeTab === "deposits") swAdminFetchDeposits(depositFilter);
    else if (activeTab === "withdraws") swAdminFetchWithdrawals(withdrawFilter);
    else if (activeTab === "users") swAdminFetchUsers();
  };

  window.swCreateBackendOrder = async function (amount) {
    const uid = getCurrentUid();
    const phone = getCurrentPhone();
    const numAmt = Number(amount);
    if (!uid) {
      if (typeof showToast === "function") showToast("⚠️", "पहले लॉगिन या रजिस्टर करें ताकि UID मिल सके।");
      return null;
    }
    if (!Number.isFinite(numAmt) || numAmt < 10) {
      if (typeof showToast === "function") showToast("⚠️", "सही अमाउंट दर्ज करें।");
      return null;
    }

    const res = await fetch(`${LIVE_API}/api/deposit/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, phone, amount: numAmt })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "ऑर्डर नहीं बन पाया");
    }
    liveOrderId = data.order.orderId;
    return data;
  };

  window.swSubmitBackendUtr = async function (utr, orderId) {
    const targetOrderId = String(orderId || liveOrderId || "").trim();
    const cleanUtr = String(utr || "").trim();
    if (!targetOrderId) throw new Error("पहले Deposit Order बनाएं।");
    if (cleanUtr.length < 6) throw new Error("कम से कम 6 अंकों का UTR दर्ज करें।");

    const res = await fetch(`${LIVE_API}/api/deposit/submit-utr`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: targetOrderId, utr: cleanUtr })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "UTR सबमिट नहीं हो पाया");
    }
    return data.order;
  };

  window.swCreateBackendWithdraw = async function (amount, methodInfo) {
    const uid = getCurrentUid();
    const phone = getCurrentPhone();
    const res = await fetch(`${LIVE_API}/api/withdraw/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, phone, amount: Number(amount), methodInfo: String(methodInfo || "") })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "विड्रॉल रिक्वेस्ट नहीं बन पाई");
    }
    await swSyncBackendWallet();
    return data;
  };

  window.swSyncBackendWallet = async function () {
    const uid = getCurrentUid();
    const phone = getCurrentPhone();
    if (!uid) return;
    try {
      const q = phone ? `?phone=${encodeURIComponent(phone)}` : "";
      const res = await fetch(`${LIVE_API}/api/wallet/${encodeURIComponent(uid)}${q}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        if (typeof data.balance === "number" && typeof walletBalance !== "undefined") {
          walletBalance = data.balance;
          localStorage.setItem("star_wallet_bal", String(walletBalance));
        }
        if (Array.isArray(data.deposits) && typeof depositHistory !== "undefined") {
          depositHistory = data.deposits.map((d) => ({
            orderNumber: d.orderId,
            date: String(d.createdAt || "").slice(0, 10),
            time: d.createdAt ? new Date(d.createdAt).toLocaleTimeString() : "",
            channel: "Direct Account / UPI",
            amount: Number(d.amount || 0),
            status: d.status === "credited" ? "Success" : d.status === "rejected" ? "Rejected" : "Pending",
            reference: d.utr || ""
          }));
          localStorage.setItem("star_dep_logs", JSON.stringify(depositHistory));
          if (typeof renderDepositHistoryRows === "function") renderDepositHistoryRows();
        }
        if (typeof updateBalanceDisplays === "function") updateBalanceDisplays();
      }
    } catch (_) {}
  };

  function renderUserReport(report) {
    const box = document.getElementById("swUserReportBox");
    if (!box || !report || !report.user) return;
    const u = report.user;
    const s = report.stats || {};
    lastLookedUpUid = u.uid;

    const uidInp = document.getElementById("swLookupUid");
    const phInp = document.getElementById("swLookupPhone");
    const brInp = document.getElementById("swBlockReason");
    const isInp = document.getElementById("swAccountIssue");
    if (uidInp && !uidInp.value) uidInp.value = u.uid;
    if (phInp && u.phone) phInp.value = u.phone;
    if (brInp) brInp.value = u.blockReason || "";
    if (isInp) isInp.value = u.accountIssue || "";

    box.innerHTML = `
      <div style="border:1px solid rgba(56,189,248,0.35);border-radius:10px;padding:10px;background:rgba(15,23,42,0.85);font-size:12px;color:#e2e8f0;">
        <div style="display:flex;justify-content:space-between;font-weight:700;color:#fff;">
          <span>UID: ${u.uid}</span>
          <span style="color:#4ade80;">Bal: ₹${Number(u.balance || 0)}</span>
        </div>
        <div style="margin-top:4px;color:#cbd5e1;">Mobile: <b>${u.phone || "-"}</b> • Status: <b style="color:${u.blocked ? "#f87171" : "#4ade80"};">${u.blocked ? "BLOCKED" : "ACTIVE"}</b></div>
        ${u.blockReason ? `<div style="margin-top:3px;color:#fca5a5;font-size:11px;">Block Reason: ${u.blockReason}</div>` : ""}
        ${u.accountIssue ? `<div style="margin-top:3px;color:#fbbf24;font-size:11px;">Account Issue: ${u.accountIssue}</div>` : ""}
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:8px;font-size:11px;">
          <div style="padding:6px;border-radius:6px;background:#0f172a;">Total Recharge: <b>₹${s.totalRechargeCredited || 0}</b> (${s.rechargeCount || 0})</div>
          <div style="padding:6px;border-radius:6px;background:#0f172a;">Pending Recharge: <b>₹${s.pendingRechargeAmount || 0}</b></div>
          <div style="padding:6px;border-radius:6px;background:#0f172a;">Approved WD: <b>₹${s.totalWithdrawalApproved || 0}</b> (${s.withdrawalCount || 0})</div>
          <div style="padding:6px;border-radius:6px;background:#0f172a;">Pending WD: <b>₹${s.pendingWithdrawalAmount || 0}</b></div>
        </div>
      </div>
    `;
  }

  window.swSuiteLookupUser = async function () {
    const box = document.getElementById("swUserReportBox");
    if (!box) return;
    const uid = String(document.getElementById("swLookupUid")?.value || "").trim();
    const phone = String(document.getElementById("swLookupPhone")?.value || "").trim();
    const token = getAdminToken();

    if (!token) {
      box.innerHTML = `<div style="padding:8px;color:#fbbf24;font-size:12px;">कृपया Admin Token दर्ज करें।</div>`;
      return;
    }
    if (!uid && !phone) {
      box.innerHTML = `<div style="padding:8px;color:#fbbf24;font-size:12px;">UID या Mobile Number दर्ज करें।</div>`;
      return;
    }

    box.innerHTML = `<div style="padding:8px;color:#94a3b8;font-size:12px;">यूज़र डाटा लोड हो रहा है...</div>`;
    try {
      const qs = new URLSearchParams();
      if (uid) qs.set("uid", uid);
      if (phone) qs.set("phone", phone);
      const res = await fetch(`${LIVE_API}/api/admin/user-lookup?${qs.toString()}`, {
        headers: { "x-admin-token": token }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        box.innerHTML = `<div style="padding:8px;color:#f87171;font-size:12px;">${data.error || "यूज़र नहीं मिला"}</div>`;
        return;
      }
      renderUserReport(data);
    } catch (err) {
      box.innerHTML = `<div style="padding:8px;color:#f87171;font-size:12px;">एरर: ${err.message}</div>`;
    }
  };

  window.swSuiteAdjustWallet = async function (mode) {
    const uid = String(document.getElementById("const uid = String(document.getElementById("swLookupUid")?.value || lastLookedUpUid || "").trim();
    const phone = String(document.getElementById("swLookupPhone")?.value || "").trim();
    const amount = Number(document.getElementById("swWalletAmount")?.value);
    const note = String(document.getElementById("swWalletNote")?.value || "").trim();
    const token = getAdminToken();

    if (!token) {
      if (typeof showToast === "function") showToast("⚠️", "Admin Token डालें।");
      return;
    }
    if ((!uid && !phone) || !Number.isFinite(amount) || amount < 0) {
      if (typeof showToast === "function") showToast("⚠️", "UID/Mobile और सही अमाउंट डालें।");
      return;
    }

    const res = await fetch(`${LIVE_API}/api/admin/wallet/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ uid, phone, mode, amount, note })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (typeof showToast === "function") showToast("❌", data.error || "बैलेंस अपडेट नहीं हो पाया");
      return;
    }

    if (typeof showToast === "function") showToast("✅", `नया बैलेंस: ₹${data.walletBalance}`);
    await swSuiteLookupUser();
    await swSyncBackendWallet();
  };

  window.swSuiteModerate = async function (blockedState) {
    const uid = String(document.getElementById("swLookupUid")?.value || lastLookedUpUid || "").trim();
    const phone = String(document.getElementById("swLookupPhone")?.value || "").trim();
    const blockReason = String(document.getElementById("swBlockReason")?.value || "").trim();
    const accountIssue = String(document.getElementById("swAccountIssue")?.value || "").trim();
    const token = getAdminToken();

    if (!token) {
      if (typeof showToast === "function") showToast("⚠️", "Admin Token डालें।");
      return;
    }
    if (!uid && !phone) {
      if (typeof showToast === "function") showToast("⚠️", "UID या Mobile Number डालें।");
      return;
    }

    const payload = { uid, phone, blockReason, accountIssue };
    if (typeof blockedState === "boolean") payload.blocked = blockedState;

    const res = await fetch(`${LIVE_API}/api/admin/users/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (typeof showToast === "function") showToast("❌", data.error || "अपडेट नहीं हो पाया");
      return;
    }

    if (typeof showToast === "function") showToast("✅", "अकाउंट सेटिंग सेव हो गई।");
    renderUserReport(data);
  };

  window.swAdminFetchDeposits = async function (statusFilter) {
    if (typeof statusFilter === "string") depositFilter = statusFilter;
    const listEl = document.getElementById("swAdminList");
    if (!listEl) return;
    const token = getAdminToken();
    if (!token) {
      listEl.innerHTML = `<div style="padding:10px;color:#fbbf24;font-size:12px;">कृपया Admin Token दर्ज करें।</div>`;
      return;
    }
    listEl.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:12px;">लोड हो रहा है...</div>`;

    try {
      const q = depositFilter ? `?status=${encodeURIComponent(depositFilter)}` : "";
      const res = await fetch(`${LIVE_API}/api/admin/deposits${q}`, {
        headers: { "x-admin-token": token }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        listEl.innerHTML = `<div style="padding:10px;color:#f87171;font-size:12px;">${data.error || "ऑर्डर लोड नहीं हो पाए"}</div>`;
        return;
      }

      const items = Array.isArray(data.deposits) ? data.deposits : [];
      if (!items.length) {
        listEl.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:12px;">कोई डिपॉज़िट ऑर्डर नहीं मिला।</div>`;
        return;
      }

      listEl.innerHTML = items
        .map((d) => {
          const canAct = d.status !== "credited" && d.status !== "rejected";
          return `
            <div style="border:1px solid rgba(148,163,184,0.25);border-radius:10px;padding:10px;margin-top:8px;background:rgba(15,23,42,0.7);">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;color:#fff;">
                <span>UID: ${d.uid}</span>
                <span style="color:#38bdf8;">₹${Number(d.amount || 0)}</span>
              </div>
              <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">Order: ${d.orderId}</div>
              <div style="font-size:11px;color:#fbbf24;margin-top:2px;">UTR: ${d.utr || "-"} • Status: ${d.status}</div>
              ${
                canAct
                  ? `<div style="display:flex;gap:8px;margin-top:8px;">
                      <button type="button" onclick="swAdminReview('${d.orderId}','approve')" style="flex:1;padding:6px 10px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Approve</button>
                      <button type="button" onclick="swAdminReview('${d.orderId}','reject')" style="flex:1;padding:6px 10px;border-radius:8px;border:none;background:#dc2626;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Reject</button>
                    </div>`
                  : ""
              }
            </div>
          `;
        })
        .join("");
    } catch (err) {
      listEl.innerHTML = `<div style="padding:10px;color:#f87171;font-size:12px;">नेटवर्क एरर: ${err.message}</div>`;
    }
  };

  window.swAdminReview = async function (orderId, action) {
    const token = getAdminToken();
    const res = await fetch(`${LIVE_API}/api/admin/deposits/${encodeURIComponent(orderId)}/${action}`, {
      method: "POST",
      headers: { "x-admin-token": token }
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (typeof showToast === "function") showToast("❌", data.error || "एक्शन पूरा नहीं हो पाया");
      return;
    }

    if (action === "approve") {
      if (typeof showToast === "function") showToast("✅", `क्रेडिट हो गया! नया बैलेंस: ₹${data.walletBalance}`);
    } else {
      if (typeof showToast === "function") showToast("ℹ️", "ऑर्डर रिजेक्ट कर दिया गया।");
    }

    await swAdminFetchDeposits(depositFilter);
    await swSyncBackendWallet();
  };

  window.swAdminFetchWithdrawals = async function (statusFilter) {
    if (typeof statusFilter === "string") withdrawFilter = statusFilter;
    const listEl = document.getElementById("swWithdrawList");
    if (!listEl) return;
    const token = getAdminToken();
    if (!token) {
      listEl.innerHTML = `<div style="padding:10px;color:#fbbf24;font-size:12px;">कृपया Admin Token दर्ज करें।</div>`;
      return;
    }
    listEl.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:12px;">विड्रॉल लोड हो रहे हैं...</div>`;

    try {
      const q = withdrawFilter ? `?status=${encodeURIComponent(withdrawFilter)}` : "";
      const res = await fetch(`${LIVE_API}/api/admin/withdrawals${q}`, {
        headers: { "x-admin-token": token }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        listEl.innerHTML = `<div style="padding:10px;color:#f87171;font-size:12px;">${data.error || "विड्रॉल लोड नहीं हो पाए"}</div>`;
        return;
      }

      const items = Array.isArray(data.withdrawals) ? data.withdrawals : [];
      if (!items.length) {
        listEl.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:12px;">कोई विड्रॉल रिक्वेस्ट नहीं मिली।</div>`;
        return;
      }

      listEl.innerHTML = items
        .map((w) => {
          const canAct = w.status === "pending";
          return `
            <div style="border:1px solid rgba(148,163,184,0.25);border-radius:10px;padding:10px;margin-top:8px;background:rgba(15,23,42,0.7);">
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;font-weight:700;color:#fff;">
                <span>UID: ${w.uid}</span>
                <span style="color:#f59e0b;">₹${Number(w.amount || 0)}</span>
              </div>
              <div style="font-size:11px;color:#cbd5e1;margin-top:4px;">WD ID: ${w.withdrawId} • Mobile: ${w.phone || "-"}</div>
              <div style="font-size:11px;color:#94a3b8;margin-top:2px;">Method: ${w.methodInfo || "-"} • Status: ${w.status}</div>
              ${
                canAct
                  ? `<div style="display:flex;gap:8px;margin-top:8px;">
                      <button type="button" onclick="swAdminReviewWithdraw('${w.withdrawId}','approve')" style="flex:1;padding:6px 10px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Approve WD</button>
                      <button type="button" onclick="swAdminReviewWithdraw('${w.withdrawId}','reject')" style="flex:1;padding:6px 10px;border-radius:8px;border:none;background:#dc2626;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Reject & Refund</button>
                    </div>`
                  : ""
              }
            </div>
          `;
        })
        .join("");
    } catch (err) {
      listEl.innerHTML = `<div style="padding:10px;color:#f87171;font-size:12px;">नेटवर्क एरर: ${err.message}</div>`;
    }
  };

  window.swAdminReviewWithdraw = async function (withdrawId, action) {
    const token = getAdminToken();
    const res = await fetch(`${LIVE_API}/api/admin/withdrawals/${encodeURIComponent(withdrawId)}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (typeof showToast === "function") showToast("❌", data.error || "एक्शन पूरा नहीं हो पाया");
      return;
    }

    if (typeof showToast === "function") {
      showToast("✅", action === "approve" ? "विड्रॉल अप्रूव हो गया।" : "विड्रॉल रिजेक्ट और बैलेंस रिफंड हो गया।");
    }
    await swAdminFetchWithdrawals(withdrawFilter);
    await swSyncBackendWallet();
  };

  window.swAdminFetchUsers = async function () {
    const usersEl = document.getElementById("swAllUsersList");
    if (!usersEl) return;
    const token = getAdminToken();
    if (!token) {
      usersEl.innerHTML = `<div style="padding:10px;color:#fbbf24;font-size:12px;">कृपया Admin Token दर्ज करें।</div>`;
      return;
    }
    usersEl.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:12px;">यूज़र्स लोड हो रहे हैं...</div>`;

    try {
      const res = await fetch(`${LIVE_API}/api/admin/users`, {
        headers: { "x-admin-token": token }
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        usersEl.innerHTML = `<div style="padding:10px;color:#f87171;font-size:12px;">${data.error || "यूज़र्स लोड नहीं हो पाए"}</div>`;
        return;
      }
      const list = Array.isArray(data.users) ? data.users : [];
      if (!list.length) {
        usersEl.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:12px;">कोई यूज़र रिकॉर्ड नहीं मिला।</div>`;
        return;
      }
      usersEl.innerHTML = list
        .map(
          (u) => `
          <div onclick="document.getElementById('swLookupUid').value='${u.uid}';document.getElementById('swLookupPhone').value='${u.phone || ""}';swSuiteSwitchTab('lookup');swSuiteLookupUser();" style="border:1px solid rgba(148,163,184,0.2);border-radius:8px;padding:8px 10px;margin-top:6px;background:rgba(15,23,42,0.65);cursor:pointer;font-size:12px;color:#e2e8f0;">
            <div style="display:flex;justify-content:space-between;">
              <span>UID: <b>${u.uid}</b> (${u.phone || "No Phone"})</span>
              <span style="color:#4ade80;font-weight:700;">₹${Number(u.balance || 0)}</span>
            </div>
            <div style="font-size:11px;margin-top:3px;color:${u.blocked ? "#f87171" : "#94a3b8"};">
              ${u.blocked ? "🚫 BLOCKED" : "✅ ACTIVE"}${u.accountIssue ? " • ⚠️ Issue: " + u.accountIssue : ""}
            </div>
          </div>
        `
        )
        .join("");
    } catch (err) {
      usersEl.innerHTML = `<div style="padding:10px;color:#f87171;font-size:12px;">एरर: ${err.message}</div>`;
    }
  };

  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!target) return;
    const text = (target.innerText || "").trim();
    if (text === "Account" || text.includes("Service center")) {
      secretTapCount += 1;
      clearTimeout(secretTapTimer);
      secretTapTimer = setTimeout(() => {
        secretTapCount = 0;
      }, 1500);
      if (secretTapCount >= 5) {
        secretTapCount = 0;
        window.swUnlockSecretAdmin();
      }
    }
  });

  window.addEventListener("hashchange", applySecretVisibility);

  const prevEnterPortal = window.enterPortal;
  if (typeof prevEnterPortal === "function") {
    window.enterPortal = function (phone) {
      prevEnterPortal(phone);
      applySecretVisibility();
      swSyncBackendWallet();
    };
  }

  const prevRefresh = window.refreshBalanceAnim;
  if (typeof prevRefresh === "function") {
    window.refreshBalanceAnim = function (...args) {
      const res = prevRefresh.apply(this, args);
      swSyncBackendWallet();
      return res;
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    applySecretVisibility();
    swSyncBackendWallet();
  });
  setTimeout(applySecretVisibility, 800);
})();
