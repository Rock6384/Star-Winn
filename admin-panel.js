// ======================================================
// STARWINN ADMIN UTR APPROVAL + LIVE RENDER BACKEND
// ======================================================
(function initStarWinnLiveLedger() {
  const LIVE_API = "https://star-winn-server.onrender.com";
  let liveOrderId = "";

  function getCurrentUid() {
    return (
      localStorage.getItem("star_active_uid") ||
      localStorage.getItem("star_uid") ||
      localStorage.getItem("sw_uid") ||
      ""
    ).trim();
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

  window.swAdminFetchDeposits = async function (statusFilter) {
    const listEl = document.getElementById("swAdminList");
    if (!listEl) return;
    const tokenInput = document.getElementById("swAdminTokenInput");
    const token =
      (tokenInput ? tokenInput.value : "").trim() ||
      sessionStorage.getItem("sw_live_admin_token") ||
      "starwin987";
    sessionStorage.setItem("sw_live_admin_token", token);
    listEl.innerHTML = `<div style="padding:10px;color:#94a3b8;font-size:12px;">लोड हो रहा है...</div>`;

    try {
      const q = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
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
    const tokenInput = document.getElementById("swAdminTokenInput");
    const token =
      (tokenInput ? tokenInput.value : "").trim() ||
      sessionStorage.getItem("sw_live_admin_token") ||
      "starwin987";
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

    await swAdminFetchDeposits("pending_approval");
    await swSyncBackendWallet();
  };

  function upgradeAdminPanelUi() {
    // Agar pehle se ban chuka hai ya #swAdminList already hai toh dobara mat badlo
    if (document.getElementById("swAdminList") || document.querySelector("[data-sw-clean-admin='1']")) {
      return;
    }

    const candidates = Array.from(document.querySelectorAll("div, section, article, aside"));
    let targetCard = null;

    for (const el of candidates) {
      const txt = (el.innerText || "").trim();
      const hasHeading = txt.includes("Admin UTR Approval") || txt.includes("Full Admin Panel");
      if (!hasHeading) continue;
      if (txt.length > 0 && txt.length < 320 && el.querySelector("input, button")) {
        targetCard = el;
        break;
      }
    }

    if (!targetCard) return;

    targetCard.setAttribute("data-sw-clean-admin", "1");
    const savedToken = sessionStorage.getItem("sw_live_admin_token") || "starwin987";

    targetCard.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <div style="font-weight:700;font-size:14px;color:#fff;">🛡️ Admin UTR Approval</div>
        <span style="font-size:11px;padding:3px 8px;border-radius:999px;background:#0f766e;color:#ccfbf1;">Live Server</span>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <input id="swAdminTokenInput" type="password" value="${savedToken}" placeholder="Admin Token" style="flex:1;padding:8px 10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:12px;" />
        <button type="button" onclick="swAdminFetchDeposits('pending_approval')" style="padding:8px 12px;border-radius:8px;border:none;background:#0284c7;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Pending</button>
        <button type="button" onclick="swAdminFetchDeposits('')" style="padding:8px 12px;border-radius:8px;border:none;background:#334155;color:#fff;font-size:12px;font-weight:600;cursor:pointer;">All</button>
      </div>

      <div id="swAdminList"></div>
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
