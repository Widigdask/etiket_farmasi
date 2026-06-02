/* Redirect to login when no active session exists. */
(function() {
      try {
        var raw = localStorage.getItem('isset/session');
        if (!raw) { window.location.href = 'index.html'; }
      } catch(e) { window.location.href = 'index.html'; }
    })();

let pasienData = [];
    let obatData = [];
    let poliData = [];
    let confirmDialogResolver = null;
    const MASTER_TABLE_PAGE_SIZE = 10;
    const masterTableState = {
      pasien: { page: 1, selected: new Set() },
      obat: { page: 1, selected: new Set() },
      poli: { page: 1, selected: new Set() }
    };
    let accounts = [];
    let currentUser = { username: "admin", name: "Admin", info: "Apoteker" };
    let systemSettings = {
      instansiName: "",
      rsName: "",
      rsAddress: "",
      apoteker: "",
      sipa: "",
      logoData: null
    };
    let selectedPrintMode = null;
    let landscapeLabelSize = { width: 75, height: 50 };
    let portraitLabelSize = { width: 72, height: 120 };
    let minumRsLabelSize = { width: 75, height: 50 };
    const minumLabelDefaultSizes = {
    "normal": { width: 75, height: 50 },
    "minum-rs": { width: 75, height: 50 },
    "high-alert": { width: 50, height: 75 },
    "etiket": { width: 75, height: 50 },
    "obat-luar": { width: 75, height: 50 },
    "instruksi": { width: 75, height: 50 }
    };

    const STORAGE_KEYS = {
      pasien: "farmasi_etiket_pasien_data_v2",
      obat: "farmasi_etiket_obat_data_v2",
      poli: "farmasi_etiket_poli_data_v2",
      instansi: "farmasi_etiket_instansi_settings_v2",
      user: "farmasi_etiket_user_v2",
      accounts: "farmasi_etiket_accounts_v1"
    };

    document.addEventListener("DOMContentLoaded", initApp);

    function initApp() {
      loadPersistentData();
      bindForms();
      renderAll();
      initAuth();
      setCurrentDates();
      document.getElementById("current-date").textContent = new Date().toLocaleDateString("id-ID", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      });
    }

    function bindForms() {
      // Form login dan register sudah dipindahkan ke index.html
      // Hanya master-form dan keyboard shortcut yang tersisa
      document.getElementById("master-form").addEventListener("submit", saveMasterRecord);
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          closeMasterModal();
          closeConfirmDialog(false);
        }
        if (e.ctrlKey && (e.key || "").toLowerCase() === "p") {
          e.preventDefault();
          if (document.getElementById("app-container").style.display !== "none") preparePrint();
        }
      });
    }

    function initAuth() {
      // Session sudah dicek di Session Guard (atas body).
      // Di sini kita load nama user dari isset/session untuk sidebar.
      try {
        var raw = localStorage.getItem('isset/session');
        if (raw) {
          var sess = JSON.parse(raw);
          currentUser.name = sess.nama || sess.username || 'User';
          currentUser.info = sess.role === 'admin' ? 'Admin' : 'Pengguna';
          currentUser.username = sess.username || '';
        }
      } catch(e) {}
      updateSidebarProfile();
      // Tampilkan app langsung (login sudah dilakukan di index.html)
      openApp();
    }

    function openApp() {
      document.getElementById("app-container").style.display = "flex";
      updateSidebarProfile();
      renderAll();
    }

    async function logout() {
      const confirmed = await showConfirmDialog("Apakah Anda yakin keluar?", {
        title: "Konfirmasi Logout",
        confirmText: "Keluar",
      });
      if (!confirmed) return;
      localStorage.removeItem('isset/session');
      showToast("Berhasil logout. Sampai jumpa!");
      setTimeout(function() { window.location.href = 'index.html'; }, 800);
    }

    function toggleSidebar() {
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("sidebar-overlay");
      if (window.matchMedia("(max-width: 980px)").matches) {
        const isOpen = sidebar.classList.contains("open");
        sidebar.classList.toggle("open", !isOpen);
        if (overlay) overlay.classList.toggle("active", !isOpen);
        if (!isOpen) {
          sidebar.scrollTop = 0;
          const menu = sidebar.querySelector(".menu");
          if (menu) menu.scrollTop = 0;
        }
      } else {
        sidebar.classList.toggle("collapsed");
      }
    }

    function showSection(id) {
      document.querySelectorAll(".section-view").forEach((el) => el.classList.remove("active"));
      document.querySelectorAll(".menu-item").forEach((el) => el.classList.remove("active"));
      document.getElementById(id).classList.add("active");
      const map = ["dashboard", "cetak-etiket", "pasien", "obat", "poli", "label-instansi", "print-settings"];
      const titles = {
        dashboard: "Dashboard",
        "cetak-etiket": "Cetak Etiket",
        pasien: "Data Pasien & RM",
        obat: "Data Obat",
        poli: "Data Poli / Ruangan",
        "label-instansi": "Label Instansi",
        "print-settings": "Pengaturan Print",
        system: "Sistem"
      };
      const idx = map.indexOf(id);
      if (idx >= 0) document.querySelectorAll(".menu-item")[idx].classList.add("active");
      document.getElementById("page-title").textContent = titles[id] || "Dashboard";
      if (id === "print-settings") updatePreview();
      // Close mobile sidebar
      if (window.matchMedia("(max-width: 980px)").matches) {
        const sidebar = document.getElementById("sidebar");
        const overlay = document.getElementById("sidebar-overlay");
        if (sidebar) sidebar.classList.remove("open");
        if (overlay) overlay.classList.remove("active");
      }
    }

    function showToast(message, type = "normal") {
      const toast = document.getElementById("toast");
      toast.textContent = message;
      toast.className = "show" + (type === "error" ? " error" : "");
      setTimeout(() => { toast.className = ""; }, 3000);
    }

    function showErrorToast(message) { showToast(message, "error"); }

    function showConfirmDialog(message, options = {}) {
      const modal = document.getElementById("confirm-modal");
      const title = document.getElementById("confirm-modal-title");
      const messageEl = document.getElementById("confirm-modal-message");
      const okButton = document.getElementById("confirm-modal-ok");
      title.textContent = options.title || "Konfirmasi";
      messageEl.textContent = message;
      okButton.textContent = options.confirmText || "Lanjutkan";
      okButton.className = "btn " + (options.danger === false ? "btn-primary" : "btn-danger");
      modal.classList.add("show");
      setTimeout(() => okButton.focus(), 30);
      return new Promise((resolve) => {
        if (confirmDialogResolver) confirmDialogResolver(false);
        confirmDialogResolver = resolve;
      });
    }

    function closeConfirmDialog(confirmed) {
      const modal = document.getElementById("confirm-modal");
      if (!modal || !modal.classList.contains("show")) return;
      modal.classList.remove("show");
      const resolve = confirmDialogResolver;
      confirmDialogResolver = null;
      if (resolve) resolve(confirmed);
    }

    function saveToStorage(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch (err) { console.error(err); showErrorToast("Gagal menyimpan. Data terlalu besar untuk browser."); }
    }

    function loadFromStorage(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        console.error(err);
        return fallback;
      }
    }

    function loadPersistentData() {
      pasienData = normalizePasien(loadFromStorage(STORAGE_KEYS.pasien, []));
      obatData = normalizeObat(loadFromStorage(STORAGE_KEYS.obat, []));
      poliData = normalizePoli(loadFromStorage(STORAGE_KEYS.poli, []));
      systemSettings = Object.assign(systemSettings, loadFromStorage(STORAGE_KEYS.instansi, {}));
      currentUser = Object.assign(currentUser, loadFromStorage(STORAGE_KEYS.user, {}));
      accounts = loadFromStorage(STORAGE_KEYS.accounts, []);
      applyInstansiSettingsToForm();
    }

    function normalizePasien(rows) {
      return Array.isArray(rows) ? rows.map((item) => ({
        id: item.id || createRecordId(),
        norm: String(item.norm || item.no_rm || item.rm || "").trim(),
        nama: String(item.nama || item.namaPasien || item.name || "").trim()
      })).filter((item) => item.norm || item.nama) : [];
    }

    function normalizeObat(rows) {
      return Array.isArray(rows) ? rows.map((item) => ({
        id: item.id || createRecordId(),
        namaObat: String(item.namaObat || item.obat || item.nama || "").trim()
      })).filter((item) => item.namaObat) : [];
    }

    function normalizePoli(rows) {
      return Array.isArray(rows) ? rows.map((item) => ({
        id: item.id || createRecordId(),
        ruangan: String(item.ruangan || item.poli || item.nama || "").trim()
      })).filter((item) => item.ruangan) : [];
    }

    function savePasienToStorage() { saveToStorage(STORAGE_KEYS.pasien, pasienData); }
    function saveObatToStorage() { saveToStorage(STORAGE_KEYS.obat, obatData); }
    function savePoliToStorage() { saveToStorage(STORAGE_KEYS.poli, poliData); }
    function saveInstansiToStorage() { saveToStorage(STORAGE_KEYS.instansi, systemSettings); }

    function renderAll() {
      renderPasienTable();
      renderObatTable();
      renderPoliTable();
      renderMasterDatalists();
      updateSidebarProfile();
      updateDashboardStats();
      updateSizeVariables();
      syncPrintModeUI();
    }

    function updateDashboardStats() {
      document.getElementById("stat-pasien").textContent = pasienData.length;
      document.getElementById("stat-obat").textContent = obatData.length;
      document.getElementById("stat-poli").textContent = poliData.length;
      const minumPrintName = getMinumLabelType() === "high-alert"
        ? "High Alert"
        : getMinumLabelType() === "etiket"
          ? "Label Etiket"
          : getMinumLabelType() === "obat-luar"
            ? "Obat Luar"
            : getMinumLabelType() === "instruksi"
              ? "Instruksi"
              : "Etiket OBAT";
      document.getElementById("stat-print").textContent = selectedPrintMode === "landscape" ? "Landcape" : selectedPrintMode === "portrait" ? "Potrait" : selectedPrintMode === "minum-rs" ? minumPrintName : "-";

      // Dashboard status indicators
      const instansiEl = document.getElementById("dash-instansi-status");
      const logoEl     = document.getElementById("dash-logo-status");
      if (instansiEl) {
        const hasInstansi = !!(systemSettings.instansiName || systemSettings.rsName);
        instansiEl.textContent = hasInstansi ? (systemSettings.rsName || systemSettings.instansiName) : "Belum diatur";
        instansiEl.style.color = hasInstansi ? "#059669" : "#94a3b8";
      }
      if (logoEl) {
        logoEl.textContent = systemSettings.logoData ? "Sudah diupload" : "Belum diupload";
        logoEl.style.color = systemSettings.logoData ? "#059669" : "#94a3b8";
      }

      // Greet name
      const greetEl = document.getElementById("dash-greet-name");
      if (greetEl) greetEl.textContent = currentUser.name || "Admin";
    }

    function updateSidebarProfile() {
      // Update sidebar profile elements
      var nameEl = document.getElementById("sidebar-admin-name");
      var roleEl = document.getElementById("sidebar-admin-info");
      var avatarEl = document.getElementById("admin-avatar-initial");
      if (nameEl) nameEl.textContent = currentUser.name || "User";
      if (roleEl) roleEl.textContent = currentUser.info || "Pengguna";
      if (avatarEl) avatarEl.textContent = (currentUser.name || "U").charAt(0).toUpperCase();
      // Update dash welcome
      var dashGreet = document.getElementById("dash-greet-name");
      if (dashGreet) dashGreet.textContent = currentUser.name || "User";
      // System settings fields
      var sysName = document.getElementById("system-name");
      var sysInfo = document.getElementById("system-info");
      if (sysName) sysName.value = currentUser.name || "Admin";
      if (sysInfo) sysInfo.value = currentUser.info || "Apoteker";
    }

    function saveSystemSettings() {
      currentUser.name = document.getElementById("system-name").value.trim() || "Admin";
      currentUser.info = document.getElementById("system-info").value.trim() || "Apoteker";
      const idx = accounts.findIndex((item) => item.username === currentUser.username);
      if (idx >= 0) {
        accounts[idx].displayName = currentUser.name;
        accounts[idx].role = currentUser.info;
        saveToStorage(STORAGE_KEYS.accounts, accounts);
      }
      saveToStorage(STORAGE_KEYS.user, currentUser);
      updateSidebarProfile();
      showToast("Pengaturan profil berhasil disimpan.");
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function createRecordId() {
      return Date.now() + Math.floor(Math.random() * 100000);
    }

    function getMasterTableConfig(type) {
      return {
        pasien: {
          data: pasienData,
          tbodyId: "tbody-pasien",
          searchId: "search-pasien",
          columnCount: 4,
          emptyText: "Belum ada data pasien.",
          searchText: (item) => item.norm + " " + item.nama,
          renderCells: (item) => `<td>${escapeHtml(item.norm)}</td><td>${escapeHtml(item.nama)}</td>`
        },
        obat: {
          data: obatData,
          tbodyId: "tbody-obat",
          searchId: "search-obat",
          columnCount: 3,
          emptyText: "Belum ada data obat.",
          searchText: (item) => item.namaObat,
          renderCells: (item) => `<td>${escapeHtml(item.namaObat)}</td>`
        },
        poli: {
          data: poliData,
          tbodyId: "tbody-poli",
          searchId: "search-poli",
          columnCount: 3,
          emptyText: "Belum ada data ruangan.",
          searchText: (item) => item.ruangan,
          renderCells: (item) => `<td>${escapeHtml(item.ruangan)}</td>`
        }
      }[type];
    }

    function getFilteredMasterData(config) {
      const query = String(document.getElementById(config.searchId)?.value || "").trim().toLowerCase();
      return query
        ? config.data.filter((item) => config.searchText(item).toLowerCase().includes(query))
        : config.data;
    }

    function getVisibleMasterData(type) {
      const config = getMasterTableConfig(type);
      const state = masterTableState[type];
      const filteredData = getFilteredMasterData(config);
      const totalPages = Math.max(1, Math.ceil(filteredData.length / MASTER_TABLE_PAGE_SIZE));
      state.page = Math.min(Math.max(state.page, 1), totalPages);
      const start = (state.page - 1) * MASTER_TABLE_PAGE_SIZE;
      return {
        config,
        state,
        filteredData,
        totalPages,
        start,
        visibleData: filteredData.slice(start, start + MASTER_TABLE_PAGE_SIZE)
      };
    }

    function renderPasienTable() { renderMasterTable("pasien"); }
    function renderObatTable() { renderMasterTable("obat"); }
    function renderPoliTable() { renderMasterTable("poli"); }

    function renderMasterTable(type) {
      const { config, state, filteredData, totalPages, start, visibleData } = getVisibleMasterData(type);
      const tbody = document.getElementById(config.tbodyId);
      const validIds = new Set(config.data.map((item) => String(item.id)));
      state.selected.forEach((id) => { if (!validIds.has(id)) state.selected.delete(id); });

      if (!config.data.length) {
        tbody.innerHTML = `<tr><td colspan="${config.columnCount}" class="empty-state">${config.emptyText}</td></tr>`;
      } else if (!visibleData.length) {
        tbody.innerHTML = `<tr><td colspan="${config.columnCount}" class="empty-state">Data tidak ditemukan.</td></tr>`;
      } else {
        tbody.innerHTML = visibleData.map((item) => {
          const id = escapeHtml(String(item.id));
          const checked = state.selected.has(String(item.id)) ? " checked" : "";
          return `
            <tr>
              <td class="selection-col"><input class="row-select" type="checkbox" data-id="${id}" onchange="toggleMasterRowSelection('${type}',this)" aria-label="Pilih data ini"${checked} /></td>
              ${config.renderCells(item)}
              <td class="action-col-wide" style="text-align:right;">
                <button class="btn btn-edit btn-sm" type="button" data-id="${id}" onclick="openMasterRowEdit('${type}',this)" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="btn btn-danger btn-sm" type="button" data-id="${id}" onclick="deleteMasterRow('${type}',this)" title="Hapus"><i class="fa-solid fa-trash"></i></button>
              </td>
            </tr>`;
        }).join("");
      }

      updateMasterTableControls(type, filteredData, totalPages, start, visibleData);
      updateDashboardStats();
    }

    function updateMasterTableControls(type, filteredData, totalPages, start, visibleData) {
      const config = getMasterTableConfig(type);
      const state = masterTableState[type];
      const selectedVisibleCount = visibleData.filter((item) => state.selected.has(String(item.id))).length;
      const allVisibleSelected = visibleData.length > 0 && selectedVisibleCount === visibleData.length;
      ["head-check-all-" + type, "check-all-" + type].forEach((id) => {
        const checkbox = document.getElementById(id);
        if (!checkbox) return;
        checkbox.checked = allVisibleSelected;
        checkbox.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
        checkbox.disabled = !visibleData.length;
      });

      const footer = document.getElementById("footer-" + type);
      if (footer) footer.hidden = !config.data.length;
      const selectedCount = document.getElementById("selected-count-" + type);
      if (selectedCount) selectedCount.textContent = state.selected.size + " data dipilih";
      const deleteSelected = document.getElementById("btn-hapus-terpilih-" + type);
      if (deleteSelected) deleteSelected.disabled = state.selected.size === 0;

      const info = document.getElementById("pagination-info-" + type);
      if (info) {
        const end = Math.min(start + MASTER_TABLE_PAGE_SIZE, filteredData.length);
        info.textContent = filteredData.length ? `Menampilkan ${start + 1}-${end} dari ${filteredData.length} data` : "0 data";
      }
      const atFirstPage = masterTableState[type].page === 1;
      const atLastPage = masterTableState[type].page === totalPages;
      document.getElementById("pagination-prev-" + type).disabled = atFirstPage;
      document.getElementById("pagination-next-" + type).disabled = atLastPage;
      document.getElementById("pagination-pages-" + type).innerHTML = renderMasterPaginationButtons(type, totalPages);
    }

    function renderMasterPaginationButtons(type, totalPages) {
      const currentPage = masterTableState[type].page;
      const pages = new Set([1, totalPages]);
      for (let page = Math.max(1, currentPage - 2); page <= Math.min(totalPages, currentPage + 2); page++) {
        pages.add(page);
      }
      const items = [];
      Array.from(pages).sort((a, b) => a - b).forEach((page, index, sortedPages) => {
        if (index && page - sortedPages[index - 1] > 1) items.push("...");
        items.push(page);
      });
      return items.map((item) => item === "..."
        ? '<span class="pagination-ellipsis">...</span>'
        : `<button class="pagination-btn${item === currentPage ? " active" : ""}" type="button" onclick="setMasterPage('${type}',${item})">${item}</button>`
      ).join("");
    }

    function setMasterPage(type, page) {
      masterTableState[type].page = page;
      renderMasterTable(type);
    }

    function changeMasterPage(type, direction) {
      const { state, totalPages } = getVisibleMasterData(type);
      if (direction === "prev") state.page = Math.max(1, state.page - 1);
      if (direction === "next") state.page = Math.min(totalPages, state.page + 1);
      renderMasterTable(type);
    }

    function toggleMasterRowSelection(type, checkbox) {
      const selected = masterTableState[type].selected;
      if (checkbox.checked) selected.add(checkbox.dataset.id);
      else selected.delete(checkbox.dataset.id);
      renderMasterTable(type);
    }

    function toggleSelectAllVisible(type, checked) {
      const { state, visibleData } = getVisibleMasterData(type);
      visibleData.forEach((item) => {
        const id = String(item.id);
        if (checked) state.selected.add(id);
        else state.selected.delete(id);
      });
      renderMasterTable(type);
    }

    function openMasterRowEdit(type, button) {
      const item = getMasterTableConfig(type).data.find((record) => String(record.id) === button.dataset.id);
      if (item) openEditModal(type, item.id);
    }

    function deleteMasterRow(type, button) {
      const item = getMasterTableConfig(type).data.find((record) => String(record.id) === button.dataset.id);
      if (!item) return;
      if (type === "pasien") deletePasien(item.id);
      if (type === "obat") deleteObat(item.id);
      if (type === "poli") deletePoli(item.id);
    }

    async function deleteSelectedMasterData(type) {
      const selected = masterTableState[type].selected;
      if (!selected.size) return showErrorToast("Pilih data yang ingin dihapus terlebih dahulu.");
      const label = type === "poli" ? "ruangan" : type;
      if (!await showConfirmDialog("Hapus " + selected.size + " data " + label + " yang dipilih? Tindakan ini tidak dapat dibatalkan.", {
        title: "Hapus Data Terpilih",
        confirmText: "Hapus"
      })) return;
      const remainingData = getMasterTableConfig(type).data.filter((item) => !selected.has(String(item.id)));
      if (type === "pasien") pasienData = remainingData;
      if (type === "obat") obatData = remainingData;
      if (type === "poli") poliData = remainingData;
      selected.clear();
      saveMasterDataByType(type);
      renderMasterTable(type);
      if (type !== "pasien") renderMasterDatalists();
      showToast("Data " + label + " yang dipilih telah dihapus.");
    }

    function saveMasterDataByType(type) {
      if (type === "pasien") savePasienToStorage();
      if (type === "obat") saveObatToStorage();
      if (type === "poli") savePoliToStorage();
    }

    async function deletePasien(id) {
      if (!await showConfirmDialog("Hapus data pasien ini? Tindakan ini tidak dapat dibatalkan.", {
        title: "Hapus Data Pasien",
        confirmText: "Hapus"
      })) return;
      pasienData = pasienData.filter((item) => item.id !== id);
      savePasienToStorage();
      renderPasienTable();
      showToast("Data pasien dihapus.");
    }

    async function deleteObat(id) {
      if (!await showConfirmDialog("Hapus data obat ini? Tindakan ini tidak dapat dibatalkan.", {
        title: "Hapus Data Obat",
        confirmText: "Hapus"
      })) return;
      obatData = obatData.filter((item) => item.id !== id);
      saveObatToStorage();
      renderObatTable();
      renderMasterDatalists();
      showToast("Data obat dihapus.");
    }

    async function deletePoli(id) {
      if (!await showConfirmDialog("Hapus data ruangan ini? Tindakan ini tidak dapat dibatalkan.", {
        title: "Hapus Data Poli",
        confirmText: "Hapus"
      })) return;
      poliData = poliData.filter((item) => item.id !== id);
      savePoliToStorage();
      renderPoliTable();
      renderMasterDatalists();
      showToast("Data ruangan dihapus.");
    }

    function openMasterModal(type) {
      const config = {
        pasien: {
          title: "Tambah Data Pasien",
          fields: `
            <div class="field"><label for="modal-norm">No. RM</label><input class="control" id="modal-norm" type="number" min="0" step="1" inputmode="numeric" required /></div>
            <div class="field"><label for="modal-nama">Nama Pasien</label><input class="control" id="modal-nama" type="text" required /></div>`
        },
        obat: {
          title: "Tambah Data Obat",
          fields: '<div class="field"><label for="modal-obat">Nama Obat</label><input class="control" id="modal-obat" type="text" required /></div>'
        },
        poli: {
          title: "Tambah Data Poli / Ruangan",
          fields: '<div class="field"><label for="modal-poli">Ruangan / Poli</label><input class="control" id="modal-poli" type="text" required /></div>'
        }
      }[type];
      document.getElementById("master-type").value = type;
      document.getElementById("master-edit-id").value = "";
      document.getElementById("master-modal-title").textContent = config.title;
      document.getElementById("master-fields").innerHTML = config.fields;
      document.getElementById("master-modal").classList.add("show");
      setTimeout(() => document.querySelector("#master-fields input")?.focus(), 30);
    }

    function openEditModal(type, id) {
      const configMap = {
        pasien: {
          title: "Edit Data Pasien",
          fields: `
            <div class="field"><label for="modal-norm">No. RM</label><input class="control" id="modal-norm" type="number" min="0" step="1" inputmode="numeric" required /></div>
            <div class="field"><label for="modal-nama">Nama Pasien</label><input class="control" id="modal-nama" type="text" required /></div>`
        },
        obat: {
          title: "Edit Data Obat",
          fields: '<div class="field"><label for="modal-obat">Nama Obat</label><input class="control" id="modal-obat" type="text" required /></div>'
        },
        poli: {
          title: "Edit Data Poli / Ruangan",
          fields: '<div class="field"><label for="modal-poli">Ruangan / Poli</label><input class="control" id="modal-poli" type="text" required /></div>'
        }
      };
      const config = configMap[type];
      document.getElementById("master-type").value = type;
      document.getElementById("master-edit-id").value = id;
      document.getElementById("master-modal-title").textContent = config.title;
      document.getElementById("master-fields").innerHTML = config.fields;
      // Pre-fill existing data
      if (type === "pasien") {
        const rec = pasienData.find((p) => p.id === id);
        if (rec) {
          document.getElementById("modal-norm").value = rec.norm;
          document.getElementById("modal-nama").value = rec.nama;
        }
      } else if (type === "obat") {
        const rec = obatData.find((item) => item.id === id);
        if (rec) document.getElementById("modal-obat").value = rec.namaObat;
      } else if (type === "poli") {
        const rec = poliData.find((item) => item.id === id);
        if (rec) document.getElementById("modal-poli").value = rec.ruangan;
      }
      document.getElementById("master-modal").classList.add("show");
      setTimeout(() => document.querySelector("#master-fields input")?.focus(), 30);
    }

    function closeMasterModal() {
      document.getElementById("master-modal").classList.remove("show");
      document.getElementById("master-form").reset();
      document.getElementById("master-fields").innerHTML = "";
      document.getElementById("master-edit-id").value = "";
    }

    async function saveMasterRecord(e) {
      e.preventDefault();
      const type = document.getElementById("master-type").value;
      const rawEditId = document.getElementById("master-edit-id").value;
      const editId = rawEditId ? Number(rawEditId) : null;

      if (type === "pasien") {
        const norm = document.getElementById("modal-norm").value.trim();
        const nama = document.getElementById("modal-nama").value.trim();
        if (!norm || !nama) return showErrorToast("No. RM dan nama pasien wajib diisi.");
        if (!/^\d+$/.test(norm)) return showErrorToast("No. RM hanya boleh berisi angka.");
        if (editId) {
          const idx = pasienData.findIndex((item) => item.id === editId);
          if (idx >= 0) { pasienData[idx].norm = norm; pasienData[idx].nama = nama; }
        } else {
          const exists = pasienData.some((item) => item.norm.toLowerCase() === norm.toLowerCase());
          if (exists && !await showConfirmDialog("No. RM ini sudah ada. Tetap tambahkan data baru?", {
            title: "Data Pasien Duplikat",
            confirmText: "Tetap Tambahkan",
            danger: false
          })) return;
          pasienData.push({ id: createRecordId(), norm, nama });
        }
        savePasienToStorage();
        renderPasienTable();
      }
      if (type === "obat") {
        const namaObat = document.getElementById("modal-obat").value.trim();
        if (!namaObat) return showErrorToast("Nama obat wajib diisi.");
        if (editId) {
          const idx = obatData.findIndex((item) => item.id === editId);
          if (idx >= 0) obatData[idx].namaObat = namaObat;
        } else {
          const exists = obatData.some((item) => item.namaObat.toLowerCase() === namaObat.toLowerCase());
          if (exists && !await showConfirmDialog("Nama obat ini sudah ada. Tetap tambahkan data baru?", {
            title: "Data Obat Duplikat",
            confirmText: "Tetap Tambahkan",
            danger: false
          })) return;
          obatData.push({ id: createRecordId(), namaObat });
        }
        saveObatToStorage();
        renderObatTable();
      }
      if (type === "poli") {
        const ruangan = document.getElementById("modal-poli").value.trim();
        if (!ruangan) return showErrorToast("Ruangan / poli wajib diisi.");
        if (editId) {
          const idx = poliData.findIndex((item) => item.id === editId);
          if (idx >= 0) poliData[idx].ruangan = ruangan;
        } else {
          const exists = poliData.some((item) => item.ruangan.toLowerCase() === ruangan.toLowerCase());
          if (exists && !await showConfirmDialog("Ruangan ini sudah ada. Tetap tambahkan data baru?", {
            title: "Data Poli Duplikat",
            confirmText: "Tetap Tambahkan",
            danger: false
          })) return;
          poliData.push({ id: createRecordId(), ruangan });
        }
        savePoliToStorage();
        renderPoliTable();
      }
      renderMasterDatalists();
      closeMasterModal();
      showToast(editId ? "Data berhasil diperbarui." : "Data berhasil disimpan.");
    }

    function renderMasterDatalists() {
      const obatList = document.getElementById("obat-options");
      const poliList = document.getElementById("poli-options");
      obatList.innerHTML = uniqueSorted(obatData.map((item) => item.namaObat)).map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
      poliList.innerHTML = uniqueSorted(poliData.map((item) => item.ruangan)).map((value) => `<option value="${escapeHtml(value)}"></option>`).join("");
    }

    function uniqueSorted(values) {
      return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "id-ID"));
    }

    function autoFillPasien(rm) {
      const found = pasienData.find((p) => String(p.norm).trim() === String(rm).trim());
      if (found) document.getElementById("dash-nama").value = found.nama;
    }

    function pickExcelValue(row, keys) {
      for (const key of keys) {
        if (row[key] !== undefined && String(row[key]).trim() !== "") return row[key];
      }
      const firstKey = Object.keys(row)[0];
      return firstKey ? row[firstKey] : "";
    }

    function readExcelRows(file, callback) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
          if (!rows.length) return showErrorToast("File Excel kosong atau format tidak terbaca.");
          callback(rows);
        } catch (err) {
          console.error(err);
          showErrorToast("Gagal membaca Excel. Pastikan file .xlsx, .xls, atau .csv benar.");
        }
      };
      reader.readAsArrayBuffer(file);
    }

    function importPasienExcel(event) {
      const file = event.target.files[0];
      if (!file) return;
      readExcelRows(file, function (rows) {
        const imported = rows.map((row, idx) => ({
          id: Date.now() + idx,
          norm: String(pickExcelValue(row, ["No. RM", "No RM", "NORM", "norm", "no_rm", "RM"])).trim(),
          nama: String(pickExcelValue(row, ["Nama Pasien", "Nama", "nama", "NAMA", "pasien"])).trim()
        })).filter((p) => /^\d+$/.test(p.norm) && p.nama);
        if (!imported.length) return showErrorToast("Data pasien tidak valid. Gunakan No. RM berupa angka dan isi Nama Pasien.");
        pasienData = pasienData.concat(imported);
        savePasienToStorage();
        renderPasienTable();
        showToast(imported.length + " data pasien berhasil diimport.");
        event.target.value = "";
      });
    }

    function importObatExcel(event) {
      const file = event.target.files[0];
      if (!file) return;
      readExcelRows(file, function (rows) {
        const imported = rows.map((row, idx) => ({
          id: Date.now() + idx,
          namaObat: String(pickExcelValue(row, ["Nama Obat", "nama obat", "NAMA OBAT", "Obat", "obat", "Nama", "nama"])).trim()
        })).filter((item) => item.namaObat);
        if (!imported.length) return showErrorToast("Kolom wajib tidak ditemukan. Gunakan kolom Nama Obat.");
        obatData = obatData.concat(imported);
        saveObatToStorage();
        renderObatTable();
        renderMasterDatalists();
        showToast(imported.length + " data obat berhasil diimport.");
        event.target.value = "";
      });
    }

    function importPoliExcel(event) {
      const file = event.target.files[0];
      if (!file) return;
      readExcelRows(file, function (rows) {
        const imported = rows.map((row, idx) => ({
          id: Date.now() + idx,
          ruangan: String(pickExcelValue(row, ["Ruangan", "ruangan", "RUANGAN", "Poli", "poli", "Nama Poli", "nama poli", "Nama", "nama"])).trim()
        })).filter((item) => item.ruangan);
        if (!imported.length) return showErrorToast("Kolom wajib tidak ditemukan. Gunakan kolom Ruangan.");
        poliData = poliData.concat(imported);
        savePoliToStorage();
        renderPoliTable();
        renderMasterDatalists();
        showToast(imported.length + " data ruangan berhasil diimport.");
        event.target.value = "";
      });
    }

    function exportMasterDataExcel(type) {
      const config = {
        pasien: {
          rows: pasienData.map((item) => ({ "No. RM": item.norm, "Nama Pasien": item.nama })),
          sheetName: "Data Pasien",
          fileName: "data-pasien"
        },
        obat: {
          rows: obatData.map((item) => ({ "Nama Obat": item.namaObat })),
          sheetName: "Data Obat",
          fileName: "data-obat"
        },
        poli: {
          rows: poliData.map((item) => ({ "Ruangan": item.ruangan })),
          sheetName: "Data Poli",
          fileName: "data-poli"
        }
      }[type];
      if (!config) return;
      if (!config.rows.length) return showErrorToast("Belum ada data untuk diexport.");
      if (typeof XLSX === "undefined") return showErrorToast("Library Excel belum tersedia. Muat ulang halaman lalu coba lagi.");
      const worksheet = XLSX.utils.json_to_sheet(config.rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, config.sheetName);
      XLSX.writeFile(workbook, config.fileName + "-" + toDateInput(new Date()) + ".xlsx");
      showToast(config.rows.length + " data berhasil diexport ke Excel.");
    }

    function searchTable(tableId, inputId) {
      const type = tableId.replace("-table", "");
      if (!masterTableState[type] || !document.getElementById(inputId)) return;
      masterTableState[type].page = 1;
      renderMasterTable(type);
    }

    function applyInstansiSettingsToForm() {
      const setValue = (id, value) => { const el = document.getElementById(id); if (el) el.value = value || ""; };
      setValue("instansi-unit-name", systemSettings.instansiName);
      setValue("instansi-rs-name", systemSettings.rsName);
      setValue("instansi-rs-address", systemSettings.rsAddress);
      setValue("instansi-apoteker", systemSettings.apoteker);
      setValue("instansi-sipa", systemSettings.sipa);
      updateLogoPreview();
    }

    function saveInstansiSettings() {
      const unit = document.getElementById("instansi-unit-name").value.trim();
      const rs = document.getElementById("instansi-rs-name").value.trim();
      if (!unit || !rs) return showErrorToast("Nama Instalasi / Unit dan Nama Rumah Sakit wajib diisi.");
      systemSettings.instansiName = unit;
      systemSettings.rsName = rs;
      systemSettings.rsAddress = document.getElementById("instansi-rs-address").value.trim();
      systemSettings.apoteker = document.getElementById("instansi-apoteker").value.trim();
      systemSettings.sipa = document.getElementById("instansi-sipa").value.trim();
      saveInstansiToStorage();
      updatePreview();
      showToast("Label instansi berhasil disimpan.");
    }

    function handleLogoUpload(event) {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 512000) return showErrorToast("Ukuran file terlalu besar. Maksimal 500KB.");
      const reader = new FileReader();
      reader.onload = function (e) {
        systemSettings.logoData = e.target.result;
        saveInstansiToStorage();
        updateLogoPreview();
        updatePreview();
        showToast("Logo berhasil diupload.");
      };
      reader.readAsDataURL(file);
    }

    function updateLogoPreview() {
      const placeholder = document.getElementById("logo-placeholder");
      const container = document.getElementById("logo-preview-container");
      const img = document.getElementById("logo-preview-img");
      const removeBtn = document.getElementById("btn-remove-logo");
      if (!placeholder || !container || !img || !removeBtn) return;
      if (systemSettings.logoData) {
        placeholder.hidden = true;
        container.hidden = false;
        img.src = systemSettings.logoData;
        removeBtn.hidden = false;
      } else {
        placeholder.hidden = false;
        container.hidden = true;
        img.removeAttribute("src");
        removeBtn.hidden = true;
      }
    }

    function removeLogo() {
      systemSettings.logoData = null;
      document.getElementById("logo-file-input").value = "";
      saveInstansiToStorage();
      updateLogoPreview();
      updatePreview();
      showToast("Logo berhasil dihapus.");
    }

    function getInstansiValidation() {
      const unit = document.getElementById("instansi-unit-name").value.trim() || systemSettings.instansiName;
      const rs = document.getElementById("instansi-rs-name").value.trim() || systemSettings.rsName;
      if (!unit || !rs) return { ok: false, message: "Isi dan simpan Nama Instalasi / Unit serta Nama Rumah Sakit di Label Instansi." };
      return { ok: true, message: "" };
    }

    function getActiveLabelValidation() {
      const norm = document.getElementById("dash-norm").value.trim();
      const nama = document.getElementById("dash-nama").value.trim();
      const obat = document.getElementById("dash-nama-obat").value.trim();
      const labelType = getMinumLabelType();
      if (labelType === "high-alert") {
        if (!norm || !nama) return { ok: false, message: "No. RM dan Nama Pasien wajib diisi." };
      } else if (!norm || !nama || !obat) {
        return { ok: false, message: "No. RM, Nama Pasien, dan Nama Obat wajib diisi." };
      }
      if (labelType === "obat-luar" && !document.getElementById("obat-luar-cara-pakai").value.trim()) {
        return { ok: false, message: "Cara Pakai wajib diisi untuk Label Obat Luar." };
      }
      if (labelType === "instruksi") {
        const tanggalMinum = document.getElementById("instruksi-tgl-minum").value;
        const instruksiUtama = document.getElementById("instruksi-utama").value.trim();
        const instruksiMaksimal = document.getElementById("instruksi-maksimal").value.trim();
        if (!tanggalMinum || !instruksiUtama || !instruksiMaksimal) {
          return { ok: false, message: "Tanggal Minum, Instruksi Utama, dan Batas Harian wajib diisi untuk Label Instruksi." };
        }
      }
      return { ok: true, message: "" };
    }

    function preparePrint() {
      const validation = getActiveLabelValidation();
      if (!validation.ok) return showErrorToast(validation.message);
      clearPrintWarning();
      if (!selectedPrintMode) selectPrintMode("landscape");
      showSection("print-settings");
      updatePreview();
    }

    function clearPrintWarning() {
      const box = document.getElementById("print-validation-warning");
      box.textContent = "";
      box.style.display = "none";
    }

    function showPrintWarning(message) {
      const box = document.getElementById("print-validation-warning");
      box.textContent = message;
      box.style.display = "block";
      showErrorToast(message);
    }

    function selectPrintMode(mode) {
      if (mode !== "minum-rs") {
        const validation = getInstansiValidation();
        if (!validation.ok) return showPrintWarning(validation.message);
      }
      selectedPrintMode = mode;
      if (mode === "landscape") {
        document.getElementById("label-width").value = landscapeLabelSize.width;
        document.getElementById("label-height").value = landscapeLabelSize.height;
      } else if (mode === "portrait") {
        document.getElementById("label-width").value = portraitLabelSize.width;
        document.getElementById("label-height").value = portraitLabelSize.height;
      } else {
        document.getElementById("label-width").value = minumRsLabelSize.width;
        document.getElementById("label-height").value = minumRsLabelSize.height;
      }
      clearPrintWarning();
      updateSizeVariables();
      syncPrintModeUI();
      updatePreview();
      updateDashboardStats();
    }

    function syncPrintModeUI() {
      document.getElementById("mode-landscape").classList.toggle("active", selectedPrintMode === "landscape");
      document.getElementById("mode-portrait").classList.toggle("active", selectedPrintMode === "portrait");
      document.getElementById("mode-minum-rs").classList.toggle("active", selectedPrintMode === "minum-rs");
      const minumModeLabel = document.getElementById("mode-minum-rs-label");
      if (minumModeLabel) minumModeLabel.textContent = getMinumSelectedLabelText();
      const landscapePresets = document.getElementById("landscape-presets");
      const portraitPresets = document.getElementById("portrait-presets");
      if (landscapePresets) landscapePresets.hidden = selectedPrintMode !== "landscape";
      if (portraitPresets) portraitPresets.hidden = selectedPrintMode !== "portrait";
      document.getElementById("print-preview-empty").style.display = selectedPrintMode ? "none" : "block";
      document.getElementById("printable-area-landscape").style.display = selectedPrintMode === "landscape" ? "block" : "none";
      document.getElementById("printable-area-portrait").style.display = selectedPrintMode === "portrait" ? "flex" : "none";
      document.getElementById("printable-area-minum-rs").style.display = selectedPrintMode === "minum-rs" ? "block" : "none";
      document.querySelectorAll(".preset-btn").forEach((btn) => btn.classList.remove("active"));
    }

    function setLandscapePreset(width, height, btn) {
      selectedPrintMode = "landscape";
      landscapeLabelSize = { width, height };
      document.getElementById("label-width").value = width;
      document.getElementById("label-height").value = height;
      updateSizeVariables();
      syncPrintModeUI();
      if (btn) btn.classList.add("active");
      updatePreview();
    }

    function setPortraitPreset(width, height, btn) {
      selectedPrintMode = "portrait";
      portraitLabelSize = { width, height };
      document.getElementById("label-width").value = width;
      document.getElementById("label-height").value = height;
      updateSizeVariables();
      syncPrintModeUI();
      if (btn) btn.classList.add("active");
      updatePreview();
    }

    function updateManualSize() {
      const width = Math.max(20, parseFloat(document.getElementById("label-width").value) || 75);
      const height = Math.max(20, parseFloat(document.getElementById("label-height").value) || 50);
      if (selectedPrintMode === "portrait") portraitLabelSize = { width, height };
      else if (selectedPrintMode === "minum-rs") minumRsLabelSize = { width, height };
      else landscapeLabelSize = { width, height };
      updateSizeVariables();
      updatePreview();
    }

    function updateSizeVariables() {
      document.documentElement.style.setProperty("--landscape-label-width", landscapeLabelSize.width + "mm");
      document.documentElement.style.setProperty("--landscape-label-height", landscapeLabelSize.height + "mm");
      document.documentElement.style.setProperty("--portrait-label-width", portraitLabelSize.width + "mm");
      document.documentElement.style.setProperty("--portrait-label-height", portraitLabelSize.height + "mm");
      document.documentElement.style.setProperty("--minum-rs-label-width", minumRsLabelSize.width + "mm");
      document.documentElement.style.setProperty("--minum-rs-label-height", minumRsLabelSize.height + "mm");
    }

    function setCurrentDates() {
      const today = new Date();
      const bud = new Date();
      bud.setFullYear(bud.getFullYear() + 1);
      document.getElementById("dash-tgl-resep").value = toDateInput(today);
      document.getElementById("dash-tgl-bud").value = toDateInput(bud);
      document.getElementById("etiket-tgl-minum").value = toDateInput(today);
      document.getElementById("instruksi-tgl-minum").value = toDateInput(today);
    }

    function toDateInput(date) {
      return date.toISOString().slice(0, 10);
    }

    function formatTanggal(dateStr) {
      if (!dateStr) return "";
      return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", {
        day: "2-digit", month: "short", year: "numeric"
      }).toUpperCase();
    }

    function readNumberString(id) {
      const el = document.getElementById(id);
      return el ? String(el.value || "").trim() : "";
    }

    function getInputData() {
      return {
        norm: readNumberString("dash-norm") || "-",
        nama: (document.getElementById("dash-nama").value.trim() || "-").toUpperCase(),
        noRegistrasi: readNumberString("dash-no-registrasi") || "-",
        tglResep: formatTanggal(document.getElementById("dash-tgl-resep").value) || "-",
        noResep: readNumberString("dash-no-resep") || "-",
        poli: (document.getElementById("dash-poli").value.trim() || "-").toUpperCase(),
        obat: (document.getElementById("dash-nama-obat").value.trim() || "-").toUpperCase(),
        qty: document.getElementById("dash-qty").value.trim() || "-",
        bud: formatTanggal(document.getElementById("dash-tgl-bud").value),
        aturan: (document.getElementById("dash-aturan-minum").value.trim() || "-").toUpperCase(),
        pakai: document.getElementById("dash-aturan-pakai").value.trim(),
        ket: document.getElementById("dash-keterangan").value.trim()
      };
    }

    function updateLogo(el, fallbackIcon) {
      el.innerHTML = systemSettings.logoData ? '<img src="' + systemSettings.logoData + '" alt="Logo">' : fallbackIcon;
    }

    function updatePreview() {
      updateLandscapePreview();
      updatePortraitPreview();
      updateMinumRsPreview();
      syncPrintModeUI();
    }

    function updateLandscapePreview() {
      const data = getInputData();
      document.getElementById("label75-instansi-name").textContent = systemSettings.instansiName || "INSTALASI FARMASI";
      document.getElementById("label75-rs-name").textContent = systemSettings.rsName || "NAMA RUMAH SAKIT";
      updateLogo(document.getElementById("label75-logo"), '<i class="fa-solid fa-heart-pulse"></i>');
      setText("label75-nama", data.nama);
      setText("label75-norm", data.norm);
      setText("label75-tgl-resep", data.tglResep);
      setText("label75-no-resep", data.noResep);
      setText("label75-poli", data.poli);
      setText("label75-obat", data.obat);
      setText("label75-qty", data.qty);
      setText("label75-bud", data.bud);
      setText("label75-aturan-minum", data.aturan);
      setText("label75-pakai", [data.pakai, data.ket].filter(Boolean).join(" | ").toUpperCase());
      fitLabelText("#printable-area-landscape", [
        ["#label75-instansi-name", 7.2, 4.6],
        ["#label75-rs-name", 8.4, 4.8],
        ["#label75-nama", 7.4, 5.1],
        ["#label75-norm", 6.8, 4.8],
        ["#label75-obat", 8, 5.2],
        ["#label75-aturan-minum", 9, 6.5],
        ["#label75-pakai", 6.5, 4.8]
      ]);
    }

    function updatePortraitPreview() {
      const data = getInputData();
      document.getElementById("preview-instansi-name").textContent = systemSettings.instansiName || "INSTALASI FARMASI";
      document.getElementById("preview-rs-name").textContent = systemSettings.rsName || "NAMA RUMAH SAKIT";
      setText("preview-rs-address", systemSettings.rsAddress || "");
      setText("preview-apoteker", systemSettings.apoteker ? "Apoteker: " + systemSettings.apoteker : "");
      setText("preview-sipa", systemSettings.sipa ? "SIPA: " + systemSettings.sipa : "");
      updateLogo(document.getElementById("preview-logo"), '<i class="fa-solid fa-hospital"></i>');
      setText("preview-norm", data.norm);
      setText("preview-nama", data.nama);
      setText("preview-no-registrasi", data.noRegistrasi);
      setText("preview-tgl-resep", data.tglResep);
      setText("preview-no-resep", data.noResep);
      setText("preview-poli", data.poli);
      setText("preview-obat", data.obat);
      setText("preview-qty", data.qty);
      setText("preview-bud", data.bud);
      setText("preview-aturan-minum", data.aturan);
      setText("preview-pakai", [data.pakai, data.ket].filter(Boolean).join(" | ").toUpperCase());

      if (data.norm && data.norm !== "-" && window.JsBarcode) {
        try {
          JsBarcode("#barcode", data.norm, { format: "CODE128", lineColor: "#000", width: 0.82, height: 26, displayValue: false, margin: 0 });
          document.getElementById("barcode").style.display = "block";
        } catch (err) {
          document.getElementById("barcode").style.display = "none";
        }
      }
      fitLabelText("#printable-area-portrait", [
        ["#preview-instansi-name", 8.5, 5],
        ["#preview-rs-name", 9.5, 5],
        ["#preview-nama", 12, 7],
        ["#preview-norm", 8, 5],
        ["#preview-obat", 11, 6],
        ["#preview-aturan-minum", 12, 7],
        ["#preview-pakai", 7, 4.8]
      ]);
    }

    function formatTanggalAngka(dateStr) {
      if (!dateStr) return "";
      const d = new Date(dateStr + "T00:00:00");
      if (Number.isNaN(d.getTime())) return "";
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = String(d.getFullYear());
      return `${day}-${month}-${year}`;
    }

    function formatJamIndonesia(value) {
      const raw = String(value || "").trim();
      if (!raw) return "";
      const parts = raw.split(":");
      if (parts.length < 2) return raw.replace(/:/g, ".");
      return `${parts[0].padStart(2, "0")}.${parts[1].padStart(2, "0")}`;
    }

    function readJamRange(id) {
      const awal = document.getElementById(id + "-jam-awal")?.value || "";
      const akhir = document.getElementById(id + "-jam-akhir")?.value || "";
      const jamAwal = formatJamIndonesia(awal);
      const jamAkhir = formatJamIndonesia(akhir);
      if (jamAwal && jamAkhir) return `${jamAwal}/${jamAkhir}`;
      return jamAwal || jamAkhir || "........";
    }

    function getIntervalNote() {
      const note = document.getElementById("minum-interval-note")?.value.trim();
      return note || (getMinumLabelType() === "high-alert" ? "15 MENIT SEBELUM MAKAN" : "15; 30 menit; 1; 2 jam");
    }

    function getHighAlertInstruction() {
      return getIntervalNote().toUpperCase();
    }

    function getMinumSchedule() {
      const ids = ["minum-pagi", "minum-siang", "minum-sore", "minum-malam", "minum-dini"];
      return ids.map((id) => {
        const check = document.getElementById(id);
        if (!check || !check.checked) return null;
        const label = document.getElementById(id + "-label")?.value.trim() || "........";
        const jam = readJamRange(id);
        const jumlah = document.getElementById(id + "-jumlah")?.value.trim() || "........";
        const satuan = document.getElementById(id + "-satuan")?.value.trim() || "Tab/Caps/Bks";
        return { id, label, jam, jumlah, satuan };
      }).filter(Boolean);
    }

    function getMealMarkerType() {
      return document.querySelector('input[name="minum-meal-marker"]:checked')?.value || "circle";
    }

    function getMealHtml() {
      const selected = new Set(Array.from(document.querySelectorAll(".minum-meal-check:checked")).map((item) => item.value));
      const markerType = getMealMarkerType();
      const items = [
        { value: "Sebelum", text: "Sebelum" },
        { value: "Sesudah", text: "Sesudah" },
        { value: "Saat", text: "Saat makan" }
      ];
      return items.map((item) => {
        const markerClass = selected.has(item.value) ? (markerType === "cross" ? " is-cross" : " is-circle") : "";
        return `<span class="minum-meal-item${markerClass}">${escapeHtml(item.text)}</span>`;
      }).join("/");
    }

    function getEtiketMealHtml() {
      const selected = new Set(Array.from(document.querySelectorAll(".minum-meal-check:checked")).map((item) => item.value));
      const markerType = getMealMarkerType();
      const items = [
        { value: "Sebelum", text: "SEBELUM" },
        { value: "Sesudah", text: "SETELAH MAKAN" }
      ];
      return items.map((item) => {
        const markerClass = selected.has(item.value) ? (markerType === "cross" ? " is-cross" : " is-circle") : "";
        return `<span class="minum-meal-item${markerClass}">${escapeHtml(item.text)}</span>`;
      }).join("/");
    }

    function getMinumLabelType() {
      return document.getElementById("minum-label-type")?.value || "minum-rs";
    }

    function getMinumSelectedLabelText() {
      const select = document.getElementById("minum-label-type");
      return select?.selectedOptions?.[0]?.textContent?.trim() || "Label Etiket OBAT";
    }

    function applyMinumLabelDefaultSize(type) {
      const size = minumLabelDefaultSizes[type] || minumLabelDefaultSizes["minum-rs"];
      minumRsLabelSize = { width: size.width, height: size.height };
      if (selectedPrintMode === "minum-rs") {
        document.getElementById("label-width").value = minumRsLabelSize.width;
        document.getElementById("label-height").value = minumRsLabelSize.height;
      }
      updateSizeVariables();
    }

    function applyMinumLabelFormMode(syncDefaults) {
      const labelType = getMinumLabelType();
      const isHighAlert = labelType === "high-alert";
      const isEtiket = labelType === "etiket";
      const isObatLuar = labelType === "obat-luar";
      const isInstruksi = labelType === "instruksi";
      const isCustomForm = isEtiket || isObatLuar || isInstruksi;
      const note = document.getElementById("minum-form-note");
      const doseGrid = document.getElementById("minum-dose-grid");
      const etiketFields = document.getElementById("etiket-minum-fields");
      const obatLuarFields = document.getElementById("obat-luar-fields");
      const instruksiFields = document.getElementById("instruksi-fields");
      const aturanField = document.getElementById("minum-aturan-field");
      const aturanLabel = document.getElementById("minum-aturan-label");
      const mealField = document.getElementById("minum-meal-field");
      const markerField = document.getElementById("minum-marker-field");
      const diniRow = document.getElementById("minum-dini-control");
      const saatMealOption = document.getElementById("meal-saat-option");
      if (note) {
        note.textContent = isEtiket
          ? "Isi Tanggal Minum dan Jam Minum secara manual. Data pasien, obat, dan ED/BUD otomatis diambil dari form bagian atas."
          : isObatLuar
            ? "Isi Cara Pakai secara manual. Data pasien, obat, dan ED/BUD otomatis diambil dari form bagian atas."
            : isInstruksi
              ? "Isi Tanggal Minum dan dua baris instruksi secara manual. Data pasien dan obat otomatis diambil dari form bagian atas."
          : isHighAlert
            ? "Centang baris yang mau dicetak. Nama waktu, jam, angka dosis, dan teks satuan bebas diedit per baris."
            : "Centang baris yang mau dicetak. Nama waktu, jam, angka dosis, dan teks satuan bebas diedit per baris. Contoh satuan: Tab/Caps/Bks, ml, tetes, sendok.";
      }
      if (doseGrid) doseGrid.hidden = isCustomForm;
      if (etiketFields) etiketFields.hidden = !isEtiket;
      if (obatLuarFields) obatLuarFields.hidden = !isObatLuar;
      if (instruksiFields) instruksiFields.hidden = !isInstruksi;
      if (aturanField) aturanField.hidden = isCustomForm;
      if (aturanLabel) aturanLabel.textContent = isHighAlert ? "Aturan Menggunakan" : "Interval / Catatan Waktu";
      if (mealField) mealField.hidden = isHighAlert || isObatLuar || isInstruksi;
      if (markerField) markerField.hidden = isHighAlert || isObatLuar || isInstruksi;
      if (diniRow) diniRow.hidden = isHighAlert;
      if (saatMealOption) saatMealOption.hidden = isEtiket;

      if (syncDefaults) {
        document.querySelectorAll(".minum-satuan").forEach((input) => {
          const current = input.value.trim();
          if (isHighAlert) {
            if (!current || current === "Tab/Caps/Bks") input.value = "UNIT";
            input.placeholder = "UNIT";
          } else {
            if (!current || current === "UNIT") input.value = "Tab/Caps/Bks";
            input.placeholder = "Tab/Caps/Bks";
          }
        });

        const noteInput = document.getElementById("minum-interval-note");
        if (noteInput && isHighAlert) {
          const currentNote = noteInput.value.trim();
          if (!currentNote || currentNote === "15; 30 menit; 1; 2 jam") {
            noteInput.value = "15 MENIT SEBELUM MAKAN";
          }
        } else if (noteInput) {
          const currentNote = noteInput.value.trim();
          if (!currentNote || currentNote === "15 MENIT SEBELUM MAKAN") {
            noteInput.value = "15; 30 menit; 1; 2 jam";
          }
        }
      }
    }

    function updateMainFormLabels() {
      const type = document.getElementById("minum-label-type")?.value || "";

      const defaultLabels = {
        "dash-tgl-resep": "Tanggal Resep",
        "dash-norm": "No. RM",
        "dash-nama": "Nama Pasien",
        "dash-nama-obat": "Nama Obat",
        "dash-tgl-bud": "ED / BUD",
        "dash-aturan-minum": "Aturan Minum",
        "dash-aturan-pakai": "Aturan Pakai"
      };

      const labelsByType = {
        "minum-rs": {
          "dash-tgl-resep": "Tgl DISIAPKAN",
          "dash-norm": "NO RM",
          "dash-nama": "Tn/Ny/Sdr",
          "dash-nama-obat": "NAMA OBAT DAN DOSIS",
          "dash-tgl-bud": "TANGGAL ED"
        },
        "high-alert": {
          "dash-tgl-resep": "Tgl. DISIAPKAN",
          "dash-norm": "No. RM",
          "dash-nama": "Tn/Ny/Sdr",
          "dash-aturan-minum": "Aturan Menggunakan"
        },
        "etiket": {
          "dash-tgl-resep": "TGL DISIAPKAN",
          "dash-norm": "NO RM",
          "dash-nama": "Tn/Ny/Sdr",
          "dash-nama-obat": "NAMA SEDIAAN DAN DOSIS",
          "dash-tgl-bud": "TGL KADALUWARSA"
        },
        "obat-luar": {
          "dash-tgl-resep": "TGL DISIAPKAN",
          "dash-norm": "NO RM",
          "dash-nama": "NAMA",
          "dash-nama-obat": "NAMA OBAT DAN DOSIS",
          "dash-tgl-bud": "TANGGAL ED",
          "dash-aturan-pakai": "CARA PAKAI"
        },
        "instruksi": {
          "dash-tgl-resep": "TGL DISIAPKAN",
          "dash-norm": "NO RM",
          "dash-nama": "NAMA",
          "dash-nama-obat": "NAMA SEDIAAN"
        }
      };

      const activeLabels = {
        ...defaultLabels,
        ...(labelsByType[type] || {})
      };

      Object.entries(activeLabels).forEach(([inputId, text]) => {
        const label = document.querySelector(`label[for="${inputId}"]`);
        if (label) label.textContent = text;
      });
    }

    function onMinumLabelTypeChange() {
      updateMainFormLabels();
      applyMinumLabelFormMode(true);
      applyMinumLabelDefaultSize(getMinumLabelType());

      if (selectedPrintMode !== "minum-rs") {
        selectPrintMode("minum-rs");
        return;
      }

      updatePreview();
      updateDashboardStats();
    }

    function getHighAlertSchedule() {
      const selectedRows = getMinumSchedule().filter((row) => row.id !== "minum-dini");
      if (selectedRows.length) {
        return selectedRows.map((row) => {
          const jumlah = String(row.jumlah || "").trim();
          return {
            label: String(row.label || "........").trim() || "........",
            jam: String(row.jam || "........").trim() || "........",
            amount: (jumlah && jumlah !== "........" ? jumlah : "........") + " UNIT"
          };
        });
      }
      const ids = [
        { id: "minum-pagi", fallback: "Pagi" },
        { id: "minum-siang", fallback: "Siang" },
        { id: "minum-sore", fallback: "Sore" },
        { id: "minum-malam", fallback: "Malam" }
      ];
      return ids.map((item) => {
        const label = document.getElementById(item.id + "-label")?.value.trim() || item.fallback;
        const jam = readJamRange(item.id);
        const jumlah = document.getElementById(item.id + "-jumlah")?.value.trim() || "........";
        const amount = (jumlah && jumlah !== "........" ? jumlah : "........") + " UNIT";
        return {
          label,
          jam,
          amount
        };
      });
    }

    function splitHighAlertDayLabel(value) {
      const characters = Array.from(String(value || "........"));
      const lines = [];
      for (let index = 0; index < characters.length; index += 10) {
        lines.push(characters.slice(index, index + 10).join(""));
      }
      return lines;
    }

    function renderHighAlertScheduleRow(row) {
      const dayLines = splitHighAlertDayLabel(row.label);
      const firstDayLine = escapeHtml(dayLines[0] || "........");
      const continuation = dayLines.slice(1).map((line) =>
        `<span class="mha-dose-day-continuation">${escapeHtml(line)}</span>`
      ).join("");
      return `
        <div class="mha-dose-row">
          <span class="mha-dose-first-line"><span class="mha-dose-day">${firstDayLine}</span> (jam ${escapeHtml(row.jam)}) : ${escapeHtml(row.amount)}</span>
          ${continuation}
        </div>
      `;
    }

    function resetHighAlertTextSizing() {
      document.querySelectorAll([
        "#printable-area-minum-rs .mha-instansi",
        "#printable-area-minum-rs .mha-rs",
        "#printable-area-minum-rs .mha-apoteker",
        "#printable-area-minum-rs .mha-top-row",
        "#printable-area-minum-rs .mha-patient-line",
        "#printable-area-minum-rs .mha-dose-row",
        "#printable-area-minum-rs .mha-alert-note",
        "#printable-area-minum-rs .mha-alert-bar"
      ].join(",")).forEach((el) => {
        el.style.removeProperty("font-size");
        el.style.removeProperty("text-overflow");
        el.style.removeProperty("overflow-wrap");
      });
    }

    function isCompactCustomLabel(labelType) {
      return labelType === "obat-luar" || labelType === "instruksi";
    }

    function getCompactCustomLabelRoot(labelType) {
      if (labelType === "obat-luar") return document.querySelector(".minum-obat-luar-template");
      if (labelType === "instruksi") return document.querySelector(".minum-instruksi-template");
      return null;
    }

    function compactCustomLabelOverflows(root) {
      return root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1;
    }

    function fitCompactCustomLabel(labelType) {
      const root = getCompactCustomLabelRoot(labelType);
      if (!root || !root.clientWidth || !root.clientHeight) return true;
      const elements = Array.from(root.querySelectorAll("[data-fit-text]"));
      elements.forEach((el) => el.style.removeProperty("font-size"));
      for (let attempt = 0; attempt < 16 && compactCustomLabelOverflows(root); attempt++) {
        let changed = false;
        elements.forEach((el) => {
          const size = parseFloat(getComputedStyle(el).fontSize) * .75;
          if (size > 6) {
            el.style.fontSize = Math.max(6, size - .5) + "pt";
            changed = true;
          }
        });
        if (!changed) break;
      }
      return !compactCustomLabelOverflows(root);
    }

    function updateMinumRsPreview() {
      const labelType = getMinumLabelType();
      const isHighAlert = labelType === "high-alert";
      const isEtiket = labelType === "etiket";
      const isObatLuar = labelType === "obat-luar";
      const isInstruksi = labelType === "instruksi";
      applyMinumLabelFormMode(false);
      const labelBox = document.getElementById("printable-area-minum-rs");
      if (labelBox) {
        labelBox.classList.toggle("minum-high-alert", isHighAlert);
        labelBox.classList.toggle("minum-etiket", isEtiket);
        labelBox.classList.toggle("minum-obat-luar", isObatLuar);
        labelBox.classList.toggle("minum-instruksi", isInstruksi);
      }
      const instansiName = systemSettings.instansiName || "INSTALASI FARMASI";
      const rsName = systemSettings.rsName || "NAMA RUMAH SAKIT";
      const apotekerMinum = systemSettings.apoteker ? "Apoteker: " + systemSettings.apoteker : "Apoteker: ........";
      const apotekerHighAlert = systemSettings.apoteker ? "Apoteker : " + systemSettings.apoteker : "Apoteker : ........";
      const apotekerObatLuar = systemSettings.apoteker ? "Apoteker : " + systemSettings.apoteker : "Apoteker : ........";
      const apotekerInstruksi = systemSettings.apoteker ? "Apt : " + systemSettings.apoteker : "Apt : ........";
      const preparedDate = formatTanggalAngka(document.getElementById("dash-tgl-resep").value) || formatTanggalAngka(toDateInput(new Date())) || "........";
      const noRm = readNumberString("dash-norm") || "........";
      const patientName = document.getElementById("dash-nama")?.value.trim() || "........";
      const drugName = document.getElementById("dash-nama-obat")?.value.trim() || "........";
      const expiryDate = formatTanggalAngka(document.getElementById("dash-tgl-bud").value) || "........";
      setText("minum-label-instansi", instansiName);
      setText("minum-label-rs", rsName);
      setText("minum-label-apoteker", apotekerMinum);
      setText("minum-label-tgl", preparedDate);
      setText("minum-label-norm", noRm);
      setText("minum-label-nama", patientName);
      setText("minum-label-obat", drugName);
      setText("minum-label-ed", expiryDate);
      setText("minum-label-interval", getIntervalNote());
      const mealLabel = document.getElementById("minum-label-makan");
      if (mealLabel) mealLabel.innerHTML = getMealHtml();

      const list = document.getElementById("minum-label-dose-list");
      const schedule = getMinumSchedule();
      const rows = schedule.length ? schedule : [
        { label: "Pagi", jam: "06.00/07.00", jumlah: "........", satuan: "Tab/Caps/Bks" },
        { label: "Siang", jam: "11.00/12.00", jumlah: "........", satuan: "Tab/Caps/Bks" },
        { label: "Sore", jam: "16.00/17.00", jumlah: "........", satuan: "Tab/Caps/Bks" },
        { label: "Malam", jam: "21.00/22.00", jumlah: "........", satuan: "Tab/Caps/Bks" },
        { label: "Pagi", jam: "02.00/03.00", jumlah: "........", satuan: "Tab/Caps/Bks" }
      ];
      list.innerHTML = rows.map((row) => {
        const jumlah = String(row.jumlah || "").trim() || "........";
        const satuan = String(row.satuan || "").trim() || "Tab/Caps/Bks";
        return `
        <div class="minum-dose-row">
          <span class="minum-dose-time">${escapeHtml(row.label)} (jam ${escapeHtml(row.jam)})</span>
          <span class="minum-dose-colon">:</span>
          <span class="minum-dose-dose">${escapeHtml(jumlah)} ${escapeHtml(satuan)}</span>
        </div>
      `;
      }).join("");

      setText("mha-label-instansi", instansiName);
      setText("mha-label-rs", rsName);
      setText("mha-label-apoteker", apotekerHighAlert);
      setText("mha-label-tgl", preparedDate);
      setText("mha-label-norm", noRm);
      setText("mha-label-nama", patientName);
      setText("mha-label-aturan", getHighAlertInstruction());
      const highAlertList = document.getElementById("mha-label-dose-list");
      if (highAlertList) {
        highAlertList.innerHTML = getHighAlertSchedule().map(renderHighAlertScheduleRow).join("");
      }

      setText("etiket-label-instansi", instansiName);
      setText("etiket-label-rs", rsName);
      setText("etiket-label-tgl-disiapkan", preparedDate);
      setText("etiket-label-norm", noRm);
      setText("etiket-label-tgl-minum", formatTanggalAngka(document.getElementById("etiket-tgl-minum")?.value) || "........");
      setText("etiket-label-nama", patientName);
      setText("etiket-label-obat", drugName);
      setText("etiket-label-ed", expiryDate);
      setText("etiket-label-jam-minum", readJamRange("etiket-minum"));
      setText("etiket-label-waktu-minum", document.getElementById("etiket-waktu-minum")?.value.trim().toUpperCase() || "PAGI");
      const etiketMealLabel = document.getElementById("etiket-label-makan");
      if (etiketMealLabel) etiketMealLabel.innerHTML = getEtiketMealHtml();

      setText("obat-luar-label-instansi", instansiName);
      setText("obat-luar-label-rs", rsName);
      setText("obat-luar-label-apoteker", apotekerObatLuar);
      setText("obat-luar-label-tgl", preparedDate);
      setText("obat-luar-label-norm", noRm);
      setText("obat-luar-label-nama", patientName);
      setText("obat-luar-label-obat", drugName);
      setText("obat-luar-label-ed", expiryDate);
      setText("obat-luar-label-cara-pakai", document.getElementById("obat-luar-cara-pakai")?.value.trim() || "........");

      setText("instruksi-label-instansi", instansiName);
      setText("instruksi-label-rs", rsName);
      setText("instruksi-label-apoteker", apotekerInstruksi);
      setText("instruksi-label-tgl-disiapkan", preparedDate);
      setText("instruksi-label-norm", noRm);
      setText("instruksi-label-tgl-minum", formatTanggalAngka(document.getElementById("instruksi-tgl-minum")?.value) || "........");
      setText("instruksi-label-nama", patientName);
      setText("instruksi-label-obat", drugName);
      setText("instruksi-label-utama", document.getElementById("instruksi-utama")?.value.trim() || "........");
      setText("instruksi-label-maksimal", document.getElementById("instruksi-maksimal")?.value.trim() || "........");

      if (isHighAlert) {
        resetHighAlertTextSizing();
      } else if (isCompactCustomLabel(labelType)) {
        fitCompactCustomLabel(labelType);
      } else if (!isEtiket) {
        fitLabelTextBySteps("#printable-area-minum-rs", [
          ["#minum-label-instansi", 7.8],
          ["#minum-label-rs", 7],
          ["#minum-label-apoteker", 5.4],
          ["#minum-label-norm", 5.9],
          ["#minum-patient-line", 6.1],
          ["#minum-drug-line", 6]
        ]);
      }
    }

    function fitLabelTextBySteps(scopeSelector, rules) {
      requestAnimationFrame(function () {
        rules.forEach(([selector, base]) => {
          document.querySelectorAll(scopeSelector + " " + selector).forEach((el) => {
            if (!el || !el.clientWidth || !el.clientHeight) return;
            el.style.fontSize = base + "pt";
            el.style.textOverflow = "clip";
            el.style.overflowWrap = "anywhere";

            let fitted = false;
            for (let step = 0; step <= 5; step++) {
              el.style.fontSize = (base - step) + "pt";
              if (isTextInsideBox(el)) {
                fitted = true;
                break;
              }
            }

            if (!fitted) {
              el.style.fontSize = (base - 5) + "pt";
              el.style.textOverflow = "ellipsis";
            }
          });
        });
      });
    }

    function isTextInsideBox(el) {
      return el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1;
    }

    function setText(id, value) {
      document.getElementById(id).textContent = value || "";
    }

    function fitLabelText(scopeSelector, rules) {
      requestAnimationFrame(function () {
        rules.forEach(([selector, max, min]) => {
          const el = document.querySelector(scopeSelector + " " + selector);
          if (!el || !el.clientWidth || !el.clientHeight) return;
          el.style.fontSize = max + "pt";
          el.style.textOverflow = "clip";

          let low = min;
          let high = max;
          let best = min;
          for (let i = 0; i < 10; i++) {
            const size = (low + high) / 2;
            el.style.fontSize = size + "pt";
            if (isTextInsideBox(el)) {
              best = size;
              low = size;
            } else {
              high = size;
            }
          }

          el.style.fontSize = best.toFixed(2) + "pt";
          el.style.textOverflow = isTextInsideBox(el) ? "clip" : "ellipsis";
        });
      });
    }

    function printSelectedLabel() {
      if (selectedPrintMode !== "minum-rs") {
        const validation = getInstansiValidation();
        if (!validation.ok) return showPrintWarning(validation.message);
      }
      if (!selectedPrintMode) return showPrintWarning("Pilih dulu mode cetak label.");
      if (selectedPrintMode === "minum-rs") {
        const validation = getActiveLabelValidation();
        if (!validation.ok) return showPrintWarning(validation.message);
      }
      clearPrintWarning();
      updateSizeVariables();
      updatePreview();
      if (selectedPrintMode === "minum-rs" && isCompactCustomLabel(getMinumLabelType()) && !fitCompactCustomLabel(getMinumLabelType())) {
        return showPrintWarning("Isi label terlalu panjang untuk ukuran 75 x 50 mm. Persingkat data sebelum mencetak.");
      }
      document.body.classList.toggle("print-landscape", selectedPrintMode === "landscape");
      document.body.classList.toggle("print-portrait", selectedPrintMode === "portrait");
      document.body.classList.toggle("print-minum-rs", selectedPrintMode === "minum-rs");
      setTimeout(function () {
        window.print();
        setTimeout(function () {
          document.body.classList.remove("print-landscape", "print-portrait", "print-minum-rs");
        }, 500);
      }, 120);
    }
