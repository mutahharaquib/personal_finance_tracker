(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const readJSON = (id) => {
    const el = document.getElementById(id);
    try { return el ? JSON.parse(el.textContent) : null; } catch { return null; }
  };
  const icons = (root) => window.lucide && window.lucide.createIcons({ root: root || document });
  const localToday = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  icons();

  /* ---------- Theme ---------- */
  function syncThemeButtons(theme) {
    $$("[data-theme-toggle]").forEach((btn) => {
      btn.querySelector("[data-theme-label]") && (btn.querySelector("[data-theme-label]").textContent = theme === "dark" ? "Light mode" : "Dark mode");
      const holder = btn.querySelector("[data-theme-icon]");
      if (holder) {
        holder.innerHTML = `<i data-lucide="${theme === "dark" ? "sun" : "moon"}"></i>`;
        icons(holder);
      }
    });
  }
  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("theme", theme); } catch {}
    syncThemeButtons(theme);
    document.dispatchEvent(new CustomEvent("themechange"));
  }
  $$("[data-theme-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"))
  );
  syncThemeButtons(document.documentElement.dataset.theme || "light");

  /* ---------- Mobile navigation ---------- */
  $$("[data-nav-toggle]").forEach((btn) =>
    btn.addEventListener("click", () => document.body.classList.toggle("nav-open"))
  );
  $(".scrim")?.addEventListener("click", () => document.body.classList.remove("nav-open"));

  /* ---------- Dialogs ---------- */
  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    dialog.showModal();
    const focus = dialog.querySelector("[autofocus]") || dialog.querySelector("input:not([type=hidden]):not([type=radio]), select, textarea");
    focus && focus.focus();
  }
  $$("[data-open]").forEach((btn) => btn.addEventListener("click", () => openDialog(btn.dataset.open)));
  $$("dialog.modal").forEach((dialog) => {
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
    $$("[data-close]", dialog).forEach((b) => b.addEventListener("click", () => dialog.close()));
  });

  /* ---------- Transaction dialog (add + edit) ---------- */
  const categories = readJSON("categories-data") || [];
  const txDialog = document.getElementById("tx-dialog");

  function fillCategories(select, type, selected) {
    if (!select) return;
    const list = categories.filter((c) => c.type === type);
    if (selected && !list.some((c) => c.name === selected)) list.unshift({ name: selected });
    select.innerHTML = "";
    for (const c of list) {
      const opt = document.createElement("option");
      opt.value = opt.textContent = c.name;
      if (c.name === selected) opt.selected = true;
      select.appendChild(opt);
    }
  }

  // Any form with a type toggle + [data-category-select] keeps categories in sync.
  $$("form[data-tx-form]").forEach((form) => {
    const select = $("[data-category-select]", form);
    const current = () => ($("input[name=type]:checked", form) || {}).value || "expense";
    $$("input[name=type]", form).forEach((r) => r.addEventListener("change", () => fillCategories(select, current())));
    fillCategories(select, current(), select && select.dataset.selected);
  });

  function resetTxDialog(mode, tx) {
    const form = $("form", txDialog);
    const editing = mode === "edit";
    $("[data-dialog-title]", txDialog).textContent = editing ? "Edit transaction" : "Add transaction";
    $("[data-submit-label]", txDialog).textContent = editing ? "Save changes" : "Add transaction";
    form.action = editing ? `/transactions/${tx._id}` : "/transactions";
    const type = editing ? tx.type : "expense";
    $(`input[name=type][value=${type}]`, form).checked = true;
    form.amount.value = editing ? tx.amount : "";
    form.date.value = editing ? tx.date : localToday();
    form.note.value = editing ? tx.note || "" : "";
    fillCategories($("[data-category-select]", form), type, editing ? tx.category : undefined);
    $("[data-delete-tx]", txDialog).hidden = !editing;
    if (editing) $("#tx-delete-form").action = `/transactions/${tx._id}/delete`;
  }

  if (txDialog) {
    $$("[data-add-tx]").forEach((btn) =>
      btn.addEventListener("click", () => { resetTxDialog("add"); openDialog("tx-dialog"); })
    );
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-edit-tx]");
      // Rows are tappable, but not when the tap was on the row's delete form.
      if (!btn || e.target.closest("form, a")) return;
      resetTxDialog("edit", JSON.parse(btn.dataset.editTx));
      openDialog("tx-dialog");
    });
    // Keyboard shortcut: "n" for a new transaction.
    document.addEventListener("keydown", (e) => {
      if (e.key !== "n" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest("input, textarea, select, [contenteditable]") || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      resetTxDialog("add");
      openDialog("tx-dialog");
    });
  }

  // Reopen the add dialog with what the user typed if the server rejected it.
  if (txDialog && txDialog.dataset.old) {
    const old = JSON.parse(txDialog.dataset.old);
    resetTxDialog("add");
    const form = $("form", txDialog);
    if (old.type === "income") { $("input[name=type][value=income]", form).checked = true; fillCategories($("[data-category-select]", form), "income"); }
    if (old.amount) form.amount.value = old.amount;
    if (old.date) form.date.value = old.date;
    if (old.note) form.note.value = old.note;
    if (old.category) form.category.value = old.category;
    openDialog("tx-dialog");
  }

  /* ---------- Budgets: prefill the dialog from the clicked row ---------- */
  $$("[data-budget-category]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const form = $("#budget-dialog form");
      form.category.value = btn.dataset.budgetCategory;
      form.amount.value = btn.dataset.budgetAmount || "";
      form.amount.focus();
    })
  );

  /* ---------- Goals: create vs edit ---------- */
  const goalForm = $("form[data-goal-form]");
  if (goalForm) {
    const setMode = (goal) => {
      $("[data-goal-title]").textContent = goal ? "Edit goal" : "New goal";
      $("[data-goal-submit]").textContent = goal ? "Save changes" : "Create goal";
      $("[data-goal-initial]").hidden = Boolean(goal);
      goalForm.action = goal ? `/goals/${goal._id}` : "/goals";
      if (goal) {
        goalForm.name.value = goal.name;
        goalForm.targetAmount.value = goal.targetAmount;
        goalForm.deadline.value = goal.deadline;
        const swatch = $(`input[name=color][value="${goal.color}"]`, goalForm);
        if (swatch) swatch.checked = true;
      } else if (!goalForm.dataset.keep) {
        goalForm.reset();
      }
      delete goalForm.dataset.keep;
    };
    $$("[data-goal]").forEach((btn) => btn.addEventListener("click", () => setMode(JSON.parse(btn.dataset.goal))));
    $$("[data-goal-new]").forEach((btn) => btn.addEventListener("click", () => setMode(null)));
  }

  // Dialogs whose form failed validation reopen automatically.
  $$("dialog[data-autoopen]").forEach((d) => {
    const form = $("form[data-goal-form]", d);
    if (form) form.dataset.keep = "1";
    openDialog(d.id);
  });

  if (location.hash === "#import" && document.getElementById("import-dialog")) openDialog("import-dialog");

  /* ---------- Small helpers ---------- */
  $$("input[type=date][data-today]").forEach((input) => { if (!input.value) input.value = localToday(); });

  $$("form[data-confirm]").forEach((form) =>
    form.addEventListener("submit", (e) => { if (!confirm(form.dataset.confirm)) e.preventDefault(); })
  );

  $$("[data-back]").forEach((a) =>
    a.addEventListener("click", (e) => { if (history.length > 1) { e.preventDefault(); history.back(); } })
  );

  $$("[data-autosubmit]").forEach((el) => el.addEventListener("change", () => el.form.submit()));

  // Show / hide password
  $$("[data-reveal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.innerHTML = `<i data-lucide="${show ? "eye-off" : "eye"}"></i>`;
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
      icons(btn);
    });
  });

  // Password strength meter
  $$("[data-pw-meter]").forEach((meter) => {
    const input = document.getElementById(meter.dataset.pwMeter);
    const bars = $$("span", meter);
    const colors = ["var(--expense)", "var(--warning)", "var(--info)", "var(--income)"];
    input.addEventListener("input", () => {
      const v = input.value;
      let score = 0;
      if (v.length >= 8) score++;
      if (/[A-Za-z]/.test(v) && /\d/.test(v)) score++;
      if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v) || v.length >= 14) score++;
      bars.forEach((b, i) => (b.style.background = i < score ? colors[score - 1] : ""));
    });
  });

  // CSV import: load the chosen file into the textarea.
  $$("[data-csv-file]").forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files[0];
      const target = document.getElementById(input.dataset.csvFile);
      if (!file || !target) return;
      if (file.size > 1.5 * 1024 * 1024) { alert("That file is too large (max 1.5 MB)."); input.value = ""; return; }
      const reader = new FileReader();
      reader.onload = () => { target.value = reader.result; };
      reader.readAsText(file);
    });
  });

  /* ---------- Toasts ---------- */
  $$(".toast").forEach((toast, i) => {
    const dismiss = () => { toast.classList.add("hide"); setTimeout(() => toast.remove(), 260); };
    $("[data-dismiss]", toast)?.addEventListener("click", dismiss);
    if (!toast.classList.contains("toast-error")) setTimeout(dismiss, 5000 + i * 600);
  });
})();
