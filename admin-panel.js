// ======================================================
// STARWINN FULL ADMIN PANEL + LIVE RENDER BACKEND
// ======================================================
(function initStarWinnLiveLedger() {
  const LIVE_API = "https://star-winn-server.onrender.com";
  let liveOrderId = "";
  let currentAdminTab = "deposits";
  let currentDepositFilter = "pending_approval";

  function getCurrentUid() {
    return (
      localStorage.getItem("star_active_uid") ||
      localStorage.getItem("star_uid") ||
      localStorage.getItem("sw_uid") ||
      ""
    ).trim();
  }

  function getAdminToken() {
    const input = document.getElementById("swAdminTokenInput");
    const val = (input ? input.value : "").trim() || sessionStorage.getItem("sw_live_admin_token") || "starwin987";
    sessionStorage.setItem("sw_live_admin_token", val);
    return val;
  }

  window.swCreateBackendOrder = async function (amount) {
    const uid = getCurrentUid();
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
      body: JSON.stringify({ uid, amount: numAmt })
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

  window.swSyncBackendWallet = async function () {
    const uid = getCurrentUid();
    if (!uid) return;
    try {
      const res = await fetch(`${LIVE_API}/api/wallet/${encodeURIComponent(uid)}`);
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

  window.swSwitchAdminTab = function (tab) {
    currentAdminTab = tab;
    const depView = document.getElementById("swAdminDepositsTab");
    const walView = document.getElementById("swAdminWalletTab");
    const btnDep = document.getElementById("swTabBtnDeposits");
    const btnWal = document.getElementById("swTabBtnWallet");

    if (depView) depView.style.display = tab === "deposits" ? "block" : "none";
    if (walView) walView.style.display = tab === "wallet" ? "block" : "none";

    if (btnDep) {
      btnDep.style.background = tab === "deposits" ? "#2563eb" : "#1e293b";
      btnDep.style.color = "#fff";
    }
    if (btnWal) {
      btnWal.style.background = tab === "wallet" ? "#2563eb" : "#1e293b";
      btnWal.style.color = "#fff";
    }

    if (tab === "deposits") {
      swAdminFetchDeposits(currentDepositFilter);
    } else {
      swAdminFetchUsers();
    }
  };

  window.swAdminFetchDeposits = async function (statusFilter) {
    if (typeof statusFilter === "string") {
      currentDepositFilter = statusFilter;
    }
    const listEl = document.getElementById("swAdminList");
    if (!listEl) return;
    const token = getAdminToken();
    listEl.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:12px;">लोड हो रहा है...</div>`;

    try {
      const q = currentDepositFilter ? `?status=${encodeURIComponent(currentDepositFilter)}` : "";
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
        listEl.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:12px;">कोई ऑर्डर नहीं मिला।</div>`;
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

    await swAdminFetchDeposits(currentDepositFilter);
    await swSyncBackendWallet();
  };

  window.swAdminFetchUsers = async function () {
    const usersEl = document.getElementById("swAdminUsersList");
    if (!usersEl) return;
    const token = getAdminToken();
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
          <div onclick="document.getElementById('swAdjustUidInput').value='${u.uid}'" style="display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(148,163,184,0.2);border-radius:8px;padding:8px 10px;margin-top:6px;background:rgba(15,23,42,0.6);cursor:pointer;font-size:12px;color:#e2e8f0;">
            <span>UID: <b>${u.uid}</b></span>
            <span style="color:#4ade80;font-weight:700;">₹${Number(u.balance || 0)}</span>
          </div>
        `
        )
        .join("");
    } catch (err) {
      usersEl.innerHTML = `<div style="padding:10px;color:#f87171;font-size:12px;">एरर: ${err.message}</div>`;
    }
  };

  window.swAdminAdjustWallet = async function (mode) {
    const uid = String(document.getElementById("swAdjustUidInput")?.value || "").trim();
    const amount = Number(document.getElementById("swAdjustAmountInput")?.value);
    const token = getAdminToken();

    if (!uid || !Number.isFinite(amount) || amount < 0) {
      if (typeof showToast === "function") showToast("⚠️", "सही UID और अमाउंट डालें।");
      return;
    }

    const res = await fetch(`${LIVE_API}/api/admin/wallet/adjust`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": token
      },
      body: JSON.stringify({ uid, mode, amount })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (typeof showToast === "function") showToast("❌", data.error || "बैलेंस अपडेट नहीं हो पाया");
      return;
    }

    if (typeof showToast === "function") showToast("✅", `UID ${uid} का नया बैलेंस: ₹${data.walletBalance}`);
    await swAdminFetchUsers();
    await swSyncBackendWallet();
  };

  function upgradeAdminPanelUi() {
    const allNodes = document.querySelectorAll("div, section");
    let targetCard = null;
    for (const el of allNodes) {
      if (
        el.textContent &&
        el.textContent.includes("Admin UTR Approval") &&
        el.querySelector("input") &&
        !el.dataset.swFullAdminUpgraded
      ) {
        if (el.innerText.length < 900) {
          targetCard = el;
          break;
        }
      }
    }
    if (!targetCard) return;

    targetCard.dataset.swFullAdminUpgraded = "1";
    const savedToken = sessionStorage.getItem("sw_live_admin_token") || "starwin987";

    targetCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-weight:700;font-size:14px;color:#fff;">🛡️ Full Admin Panel</div>
        <span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#0f766e;color:#ccfbf1;">Live Server</span>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input id="swAdminTokenInput" type="password" value="${savedToken}" placeholder="Admin Token" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;" />
        <button type="button" onclick="swSwitchAdminTab(currentAdminTab)" style="padding:8px 12px;border-radius:8px;border:none;background:#334155;color:#fff;font-size:12px;cursor:pointer;">Reload</button>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <button id="swTabBtnDeposits" type="button" onclick="swSwitchAdminTab('deposits')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Deposits & UTR</button>
        <button id="swTabBtnWallet" type="button" onclick="swSwitchAdminTab('wallet')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#1e293b;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">User Wallet</button>
      </div>

      <div id="swAdminDepositsTab">
        <div style="display:flex;gap:8px;">
          <button type="button" onclick="swAdminFetchDeposits('pending_approval')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#0284c7;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Pending</button>
          <button type="button" onclick="swAdminFetchDeposits('')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#334155;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">All</button>
        </div>
        <div id="swAdminList"></div>
      </div>

      <div id="swAdminWalletTab" style="display:none;">
        <input id="swAdjustUidInput" type="text" placeholder="User UID (e.g. 15450611)" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;margin-bottom:8px;box-sizing:border-box;" />
        <input id="swAdjustAmountInput" type="number" placeholder="Amount (₹)" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;margin-bottom:8px;box-sizing:border-box;" />
        <div style="display:flex;gap:6px;">
          <button type="button" onclick="swAdminAdjustWallet('add')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#16a34a;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">+ Add</button>
          <button type="button" onclick="swAdminAdjustWallet('set')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#2563eb;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Set</button>
          <button type="button" onclick="swAdminAdjustWallet('subtract')" style="flex:1;padding:7px;border-radius:8px;border:none;background:#dc2626;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">- Deduct</button>
        </div>
        <div id="swAdminUsersList" style="margin-top:8px;"></div>
      </div>
    `;
  }

  const prevEnterPortal = window.enterPortal;
  if (typeof prevEnterPortal === "function") {
    window.enterPortal = function (phone) {
      prevEnterPortal(phone);
      upgradeAdminPanelUi();
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
    upgradeAdminPanelUi();
    swSyncBackendWallet();
  });
  setTimeout(upgradeAdminPanelUi, 800);
})();
