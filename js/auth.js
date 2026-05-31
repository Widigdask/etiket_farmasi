/**
 * auth.js — EtiketFarma Auth System v2
 * Login, register, logout, session, lockout, password request
 * All users are treated as regular users (no admin role)
 */

/* ── DOM helper ───────────────────────────────────────────── */
function $id(id) {
  return document.getElementById(id);
}

/* ── Toast ────────────────────────────────────────────────── */
function showToast(msg, type = "success") {
  const t = $id("toast");
  if (!t) return;
  t.className = "show toast-" + type;
  const icon =
    type === "success"
      ? "fa-check-circle"
      : type === "error"
        ? "fa-times-circle"
        : "fa-exclamation-triangle";
  t.innerHTML = `<i class="fa-solid ${icon}"></i>${msg}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.className = "";
  }, 3200);
}

/* ── Alert box ────────────────────────────────────────────── */
function showAlert(panelId, type, html) {
  const el = $id(panelId + "-alert");
  if (!el) return;
  const icons = {
    error: "fa-circle-exclamation",
    success: "fa-circle-check",
    warn: "fa-triangle-exclamation",
  };
  el.className = "alert-box " + type;
  el.innerHTML = `<i class="fa-solid ${icons[type] || "fa-circle-info"}"></i><span>${html}</span>`;
  el.hidden = false;
}
function hideAlert(panelId) {
  const el = $id(panelId + "-alert");
  if (el) el.hidden = true;
}

/* ── Tab Switching ────────────────────────────────────────── */
function switchTab(tab) {
  const panels = ["login", "register", "forgot"];
  panels.forEach((p) => {
    const el = $id("panel-" + p);
    if (el) el.hidden = p !== tab;
  });
  ["login", "register"].forEach((t) => {
    const btn = $id("tab-" + t);
    if (btn) btn.classList.toggle("active", t === tab);
  });
  hideAlert("login");
  hideAlert("register");
}

function resetForgotForm() {
  const step1 = $id("forgot-step-1");
  const step2 = $id("forgot-step-2");
  const sub = $id("forgot-subtitle");
  if (step1) step1.hidden = false;
  if (step2) step2.hidden = true;
  if (sub)
    sub.textContent =
      "Masukkan username Anda. Anda dapat membuat password baru tanpa persetujuan admin.";
  hideAlert("forgot");
  const uInput = $id("forgot-username");
  if (uInput) uInput.value = "";
  const pw1 = $id("forgot-new-pw");
  if (pw1) pw1.value = "";
  const pw2 = $id("forgot-confirm-pw");
  if (pw2) pw2.value = "";
}

function showForgotPassword() {
  resetForgotForm();
  ["login", "register"].forEach((p) => {
    const el = $id("panel-" + p);
    if (el) el.hidden = true;
  });
  const f = $id("panel-forgot");
  if (f) f.hidden = false;
  ["login", "register"].forEach((t) => {
    const btn = $id("tab-" + t);
    if (btn) btn.classList.remove("active");
  });
}
function showLoginPanel() {
  switchTab("login");
  resetForgotForm();
}
function clearRegAlert() {
  hideAlert("register");
}

/* ── Toggle password visibility ───────────────────────────── */
function togglePw(inputId, btnId) {
  const input = $id(inputId),
    btn = $id(btnId);
  if (!input || !btn) return;
  const show = input.type === "text";
  input.type = show ? "password" : "text";
  btn.innerHTML = show
    ? '<i class="fa-regular fa-eye"></i>'
    : '<i class="fa-regular fa-eye-slash"></i>';
  btn.classList.toggle("showing", !show);
}

/* ── Password Strength ────────────────────────────────────── */
function checkPasswordStrength() {
  const pw = $id("reg-password");
  const wrap = $id("pw-strength-wrap");
  const fill = $id("pw-strength-fill");
  const lbl = $id("pw-strength-label");
  if (!pw || !wrap) return;
  if (!pw.value) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  let score = 0;
  if (pw.value.length >= 6) score++;
  if (pw.value.length >= 10) score++;
  if (/[A-Z]/.test(pw.value)) score++;
  if (/[0-9]/.test(pw.value)) score++;
  if (/[^A-Za-z0-9]/.test(pw.value)) score++;
  const levels = [
    { pct: "15%", color: "#ff4d6a", text: "Sangat Lemah" },
    { pct: "35%", color: "#ffa040", text: "Lemah" },
    { pct: "60%", color: "#ffcc30", text: "Cukup" },
    { pct: "80%", color: "#63b3ed", text: "Kuat" },
    { pct: "100%", color: "#0fffc2", text: "Sangat Kuat" },
  ];
  const lvl = levels[Math.min(score, 4)];
  fill.style.width = lvl.pct;
  fill.style.background = lvl.color;
  lbl.style.color = lvl.color;
  lbl.textContent = lvl.text;
}

/* ── Lockout UI ───────────────────────────────────────────── */
let _lockoutTimer = null;

function startLockoutUI(username, remaining) {
  const banner = $id("lockout-banner");
  const timerEl = $id("lockout-timer");
  const btnLogin = $id("btn-login");
  if (!banner || !timerEl) return;
  banner.hidden = false;
  if (btnLogin) btnLogin.disabled = true;
  let secs = remaining;
  timerEl.textContent = secs;
  clearInterval(_lockoutTimer);
  _lockoutTimer = setInterval(() => {
    secs--;
    timerEl.textContent = secs;
    if (secs <= 0) {
      clearInterval(_lockoutTimer);
      banner.hidden = true;
      if (btnLogin) btnLogin.disabled = false;
      const info = $id("attempt-info");
      if (info) info.hidden = true;
      hideAlert("login");
    }
  }, 1000);
}

function updateAttemptInfo(count) {
  const el = $id("attempt-info");
  if (!el) return;
  if (!count || count <= 0) {
    el.hidden = true;
    return;
  }
  let msg = "";
  if (count < 5)
    msg = `<i class="fa-solid fa-triangle-exclamation"></i> ${count}x gagal. Sisa ${5 - count}x sebelum dikunci 30 detik.`;
  else if (count < 15)
    msg = `<i class="fa-solid fa-triangle-exclamation"></i> ${count}x gagal. Sisa ${15 - count}x sebelum dikunci 60 detik.`;
  el.innerHTML = msg;
  el.hidden = !msg;
}

/* ── LOGIN ────────────────────────────────────────────────── */
async function doLogin() {
  hideAlert("login");
  const username = ($id("login-username")?.value || "").trim();
  const password = $id("login-password")?.value || "";
  if (!username || !password) {
    showAlert("login", "error", "Username dan password harus diisi.");
    return;
  }

  // Cek lockout
  const lockInfo = isLockedOut(username);
  if (lockInfo.locked) {
    startLockoutUI(username, lockInfo.remaining);
    return;
  }

  // Cari user
  const user = findUserByUsername(username);
  if (!user) {
    recordFailedAttempt(username);
    showAlert("login", "error", "Username tidak ditemukan.");
    return;
  }

  // Verifikasi password
  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) {
    const result = recordFailedAttempt(username);
    const lockAfter = isLockedOut(username);
    if (lockAfter.locked) {
      const msg =
        result.attempts >= 15
          ? `Terlalu banyak percobaan gagal. Akun dikunci <strong>60 detik</strong>.`
          : `Terlalu banyak percobaan gagal. Akun dikunci <strong>30 detik</strong>.`;
      showAlert("login", "error", msg);
      startLockoutUI(username, lockAfter.remaining);
    } else {
      showAlert("login", "error", "Password salah.");
      updateAttemptInfo(result.attempts);
    }
    return;
  }

  // Login berhasil
  resetFailedAttempts(username);
  setCurrentUser({
    id: user.id,
    nama: user.nama,
    username: user.username,
    role: user.role,
    loginAt: new Date().toISOString(),
  });
  showToast(`Selamat datang, ${user.nama}! 🎉`, "success");

  // Redirect ke app.html (loading router)
  setTimeout(() => {
    window.location.href = "app.html";
  }, 1200);
}

/* ── REGISTER ─────────────────────────────────────────────── */
async function doRegister() {
  hideAlert("register");
  const username = ($id("reg-username")?.value || "").trim();
  const nama = ($id("reg-fullname")?.value || "").trim();
  const password = $id("reg-password")?.value || "";
  const confirm = $id("reg-confirm")?.value || "";

  if (!username || !nama || !password || !confirm) {
    showAlert("register", "error", "Semua kolom wajib diisi.");
    return;
  }
  if (username.length < 3) {
    showAlert("register", "error", "Username minimal 3 karakter.");
    return;
  }
  if (!/^[a-zA-Z0-9._@+\-]+$/.test(username)) {
    showAlert(
      "register",
      "error",
      "Username hanya boleh huruf, angka, titik, underscore, atau format email.",
    );
    return;
  }
  if (password.length < 6) {
    showAlert("register", "error", "Password minimal 6 karakter.");
    return;
  }
  if (password !== confirm) {
    showAlert("register", "error", "Konfirmasi password tidak cocok.");
    return;
  }
  if (findUserByUsername(username)) {
    showAlert(
      "register",
      "error",
      `Username <strong>${username}</strong> sudah digunakan.`,
    );
    return;
  }

  const pwHash = await hashPassword(password);
  const newUser = {
    id: "user-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    nama,
    username: username.trim(),
    passwordHash: pwHash,
    role: "user",
    status: "aktif", // user baru langsung aktif tanpa perlu aktivasi admin
    requestGantiPassword: false,
    failedAttempts: 0,
    lockedUntil: null,
    createdAt: new Date().toISOString(),
  };
  addUser(newUser);
  showToast("Pendaftaran berhasil! Anda bisa login sekarang.", "success");

  // Reset form
  ["reg-username", "reg-fullname", "reg-password", "reg-confirm"].forEach(
    (id) => {
      const el = $id(id);
      if (el) el.value = "";
    },
  );
  const wrap = $id("pw-strength-wrap");
  if (wrap) wrap.hidden = true;
  switchTab("login");
  const loginUsername = $id("login-username");
  if (loginUsername) loginUsername.value = username;
  const loginPassword = $id("login-password");
  if (loginPassword) {
    loginPassword.value = "";
    loginPassword.focus();
  }
  showAlert(
    "login",
    "success",
    `Akun berhasil dibuat! Masukkan password untuk login sebagai <strong>${username}</strong>.`,
  );
}

function doForgot() {
  hideAlert("forgot");
  const username = ($id("forgot-username")?.value || "").trim();
  if (!username) {
    showAlert("forgot", "error", "Masukkan username terlebih dahulu.");
    return;
  }
  const user = findUserByUsername(username);
  if (!user) {
    showAlert("forgot", "error", "Username tidak ditemukan.");
    return;
  }

  // Tanpa admin: langsung izinkan step 2
  updateUser(user.id, {
    requestGantiPassword: false,
    resetPasswordAllowed: false,
  });

  $id("forgot-step-1").hidden = true;
  $id("forgot-step-2").hidden = false;
  const sub = $id("forgot-subtitle");
  if (sub) sub.textContent = "Masukkan password baru Anda di bawah ini.";
  showAlert("forgot", "success", "Silakan buat password baru Anda.");
  showToast("Silakan buat password baru Anda!", "success");
}

async function doResetPassword() {
  hideAlert("forgot");
  const username = ($id("forgot-username")?.value || "").trim();
  const newPw = $id("forgot-new-pw")?.value || "";
  const confirmPw = $id("forgot-confirm-pw")?.value || "";

  if (!username) {
    showAlert("forgot", "error", "Username tidak valid.");
    return;
  }
  if (!newPw || !confirmPw) {
    showAlert("forgot", "error", "Semua kolom password wajib diisi.");
    return;
  }
  if (newPw.length < 6) {
    showAlert("forgot", "error", "Password minimal 6 karakter.");
    return;
  }
  if (newPw !== confirmPw) {
    showAlert("forgot", "error", "Konfirmasi password tidak cocok.");
    return;
  }

  const user = findUserByUsername(username);
  if (!user) {
    showAlert("forgot", "error", "Username tidak valid.");
    return;
  }

  const pwHash = await hashPassword(newPw);
  updateUser(user.id, {
    passwordHash: pwHash,
    requestGantiPassword: false,
    resetPasswordAllowed: false,
    failedAttempts: 0,

    lockedUntil: null,
  });

  showAlert(
    "forgot",
    "success",
    "Password berhasil diubah! Silakan masuk kembali menggunakan password baru.",
  );
  showToast("Password berhasil diubah!", "success");

  setTimeout(() => {
    showLoginPanel();
  }, 2000);
}

/* ── LOGOUT ───────────────────────────────────────────────── */
function logout() {
  clearCurrentUser();
  showToast("Berhasil logout. Sampai jumpa!", "success");
  setTimeout(() => {
    window.location.href = "index.html";
  }, 1000);
}

/* ── SESSION PROTECTION ───────────────────────────────────── */

/** Proteksi umum: harus login. Redirect ke index.html jika belum. */
function protectPage() {
  const session = getCurrentUser();
  if (!session) {
    window.location.href = "index.html";
    return null;
  }
  return session;
}

/** Redirect ke halaman yang sesuai jika sudah login (dipakai di index.html). */
function redirectIfLoggedIn() {
  const session = getCurrentUser();
  if (!session) return;
  window.location.href = "app.html";
}

/* ── RENDER REGISTERED USERS ─────────────────────────────── */
function renderRegisteredUsers() {
  const container = $id("users-list");
  if (!container) return;
  const session = getCurrentUser();
  const users = getActiveUsers();
  if (!users.length) {
    container.innerHTML =
      '<p class="empty-users">Belum ada pengguna aktif.</p>';
    return;
  }
  container.innerHTML = users
    .map((u) => {
      const initial = (u.nama || u.username)[0].toUpperCase();
      const isMe = session && u.username === session.username;
      const date = new Date(u.createdAt).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return `
      <div class="user-item">
        <div class="user-avatar">${initial}</div>
        <div class="user-item-info">
          <div class="name">${u.nama}</div>
          <div class="uname">${u.username} · User · Daftar ${date}</div>

        </div>
        <span class="user-badge ${isMe ? "active" : ""}">
          ${isMe ? "● Aktif" : "Terdaftar"}
        </span>
      </div>`;
    })
    .join("");
}

/* ── RENDER STATISTICS ────────────────────────────────────── */
function renderStats() {
  const allUsers = getUsers();
  const activeUsers = getActiveUsers();
  const pwRequests = getPasswordRequests();
  const session = getCurrentUser();

  const set = (id, val) => {
    const el = $id(id);
    if (el) el.textContent = val;
  };
  set("stat-total-users", allUsers.length);
  set("stat-active-users", activeUsers.length);
  set("stat-pw-requests", pwRequests.length);
  set("stat-session-status", session ? "Aktif ✓" : "Tidak Aktif");
}

/* ── RENDER ADMIN PANEL ───────────────────────────────────── */
function renderAdminPanel() {
  // Admin panel dihapus: semua pengguna diperlakukan sebagai user biasa.
  // Fungsi ini dibiarkan hanya supaya kompatibel jika masih ada pemanggilan dari UI lama.
  const container = $id("admin-users-table-body");
  if (!container) return;
  container.innerHTML = "";
  return;

  // kode lama setelah return (tidak pernah dieksekusi)
  const users = getUsers();

  if (!users.length) {
    container.innerHTML =
      '<tr><td colspan="6" class="empty-state">Tidak ada pengguna.</td></tr>';
    return;
  }
  container.innerHTML = users
    .map((u) => {
      const badgeClass =
        u.status === "aktif" ? "badge-active" : "badge-inactive";
      const badgeText = u.status === "aktif" ? "Aktif" : "Nonaktif";
      const pwReqBadge = u.requestGantiPassword
        ? '<span class="badge-pw-req">Minta Ganti PW</span>'
        : "";
      return `
      <tr>
        <td>${u.nama}</td>
        <td>${u.username}</td>
        <td>${u.role === "admin" ? "👑 Admin" : "User"}</td>
        <td><span class="user-status-badge ${badgeClass}">${badgeText}</span>${pwReqBadge}</td>
        <td>
          ${
            u.status === "aktif"
              ? `<button class="btn-admin-action btn-deactivate" onclick="adminDeactivateUser('${u.id}')">Nonaktifkan</button>`
              : `<button class="btn-admin-action btn-activate"   onclick="adminActivateUser('${u.id}')">Aktifkan</button>`
          }
          ${
            u.requestGantiPassword
              ? `<button class="btn-admin-action btn-activate" onclick="adminApproveReset('${u.id}')">Setujui</button>`
              : ""
          }
          ${
            u.username !== "admin"
              ? `<button class="btn-admin-action btn-delete-user" onclick="adminDeleteUser('${u.id}', '${u.nama}')">Hapus</button>`
              : ""
          }
        </td>
      </tr>`;
    })
    .join("");
}

/* ── ADMIN ACTIONS ────────────────────────────────────────── */
// Admin actions dihapus.
// Fungsi-fungsi berikut dibiarkan kosong untuk kompatibilitas jika ada UI lama yang masih memanggilnya.
function adminActivateUser() {}
function adminDeactivateUser() {}
function adminDeleteUser() {}
function adminApproveReset() {}
