import type { Todo, User } from "./types";

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Elemen tidak ditemukan: ${selector}`);
  return element;
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}
let todos: Todo[] = [];
let filter = "all";
let editingId: number | null = null;
let busy = false;
const dateFormat = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long" });
$("#today").textContent = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

function requestApi<T>(path: string, options?: RequestInit): Promise<T>;
async function requestApi(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json" },
  });
  if (response.status === 204) return null;
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && path.startsWith("/api/todos")) setUser(null);
    throw new ApiError(data.error || "Permintaan gagal.", response.status);
  }
  return data;
}
const api = (path = "", options: RequestInit = {}) => requestApi(`/api/todos${path}`, options);
function showError(error: unknown, target = "#error") {
  $(target).textContent = error instanceof Error ? error.message : "Koneksi gagal. Periksa server lalu coba lagi.";
  $(target).hidden = false;
}
const icons = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg>',
  delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg>',
};
function render() {
  const completed = todos.filter((todo) => todo.completed).length;
  $("#total").textContent = String(todos.length);
  $("#completed").textContent = String(completed);
  $("#active").textContent = String(todos.length - completed);
  const visible = todos.filter((todo) => filter === "all" || todo.completed === (filter === "completed"));
  $("#list-count").textContent = `${visible.length} tugas`;
  $("#progress-label").textContent = todos.length ? `${completed} dari ${todos.length} tugas selesai${completed === todos.length ? '. Semua beres, selamat beristirahat!' : '. Setiap langkah berarti.'}` : "Mulai dari satu langkah kecil.";
  const list = $("#task-list");
  list.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = '<div class="empty-icon" aria-hidden="true">✓</div><strong></strong><span></span>';
    empty.querySelector("strong")!.textContent = !todos.length ? "Hari baru, rencana baru." : filter === "completed" ? "Belum ada tugas yang selesai." : "Semua tugas sudah beres.";
    empty.querySelector("span")!.textContent = !todos.length ? "Tambahkan tugas pertamamu di atas." : filter === "completed" ? "Tandai tugas yang sudah kamu kerjakan." : "Nikmati waktu luangmu atau buat rencana baru.";
    list.append(empty);
  }
  for (const todo of visible) {
    const row = document.createElement("div");
    row.className = `task${todo.completed ? " done" : ""}`;
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "task-check";
    check.checked = todo.completed;
    check.disabled = busy;
    check.setAttribute("aria-label", `Tandai ${todo.title} ${todo.completed ? "belum selesai" : "selesai"}`);
    check.addEventListener("change", () => mutate(() => api(`/${todo.id}`, { method: "PATCH", body: JSON.stringify({ completed: check.checked }) })));
    const copy = document.createElement("div");
    copy.className = "task-copy";
    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = todo.title;
    const date = document.createElement("span");
    date.className = "task-date";
    date.textContent = `Ditambahkan ${dateFormat.format(new Date(todo.created_at))}`;
    copy.append(title, date);
    const actions = document.createElement("div");
    actions.className = "task-actions";
    for (const action of ["edit", "delete"] as const) {
      const button = document.createElement("button");
      button.className = `icon-button ${action}`;
      button.innerHTML = icons[action];
      button.disabled = busy;
      button.setAttribute("aria-label", `${action === "edit" ? "Edit" : "Hapus"} ${todo.title}`);
      button.title = action === "edit" ? "Edit tugas" : "Hapus tugas";
      button.onclick = () => {
        if (action === "edit") {
          editingId = todo.id;
          $<HTMLInputElement>("#edit-title").value = todo.title;
          $("#edit-error").hidden = true;
          $<HTMLDialogElement>("#edit-dialog").showModal();
          $<HTMLInputElement>("#edit-title").focus();
        } else if (confirm(`Hapus tugas “${todo.title}”?`)) {
          mutate(() => api(`/${todo.id}`, { method: "DELETE" }));
        }
      };
      actions.append(button);
    }
    row.append(check, copy, actions);
    list.append(row);
  }
}
async function mutate(operation: () => Promise<unknown>, afterSuccess: () => void = () => {}, errorTarget = "#error") {
  if (busy) return;
  busy = true;
  $("#error").hidden = true;
  $("#edit-error").hidden = true;
  $<HTMLButtonElement>("#add-form button").disabled = true;
  $<HTMLButtonElement>("#edit-form button[type=submit]").disabled = true;
  render();
  try {
    await operation();
    afterSuccess();
    todos = await requestApi<Todo[]>("/api/todos");
  } catch (error) {
    showError(error, $<HTMLDialogElement>("#edit-dialog").open ? errorTarget : "#error");
  } finally {
    busy = false;
    $<HTMLButtonElement>("#add-form button").disabled = false;
    $<HTMLButtonElement>("#edit-form button[type=submit]").disabled = false;
    render();
  }
}
$("#add-form").onsubmit = (event) => {
  event.preventDefault();
  const title = $<HTMLInputElement>("#title").value.trim();
  if (!title) return showError(new Error("Nama tugas wajib diisi."));
  mutate(() => api("", { method: "POST", body: JSON.stringify({ title }) }), () => {
    $<HTMLInputElement>("#title").value = "";
    $<HTMLInputElement>("#title").focus();
  });
};
$("#edit-form").onsubmit = (event) => {
  event.preventDefault();
  const title = $<HTMLInputElement>("#edit-title").value.trim();
  if (!title) return showError(new Error("Nama tugas wajib diisi."), "#edit-error");
  mutate(() => api(`/${editingId}`, { method: "PATCH", body: JSON.stringify({ title }) }), () => $<HTMLDialogElement>("#edit-dialog").close(), "#edit-error");
};
$("#cancel-edit").onclick = () => $<HTMLDialogElement>("#edit-dialog").close();
document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
  button.onclick = () => {
    filter = button.dataset.filter || "all";
    document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((item) => {
      item.classList.toggle("selected", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    render();
  };
});
let authMode = "login";
function setUser(user: User | null) {
  $("#auth-panel").hidden = Boolean(user);
  $("#todo-view").hidden = !user;
  $("#account").hidden = !user;
  $(".top-note").hidden = Boolean(user);
  $("#account-name").textContent = user?.name || "";
  if (!user) {
    todos = [];
    editingId = null;
    $<HTMLDialogElement>("#edit-dialog").close();
    $<HTMLInputElement>("#title").value = "";
    $<HTMLInputElement>("#edit-title").value = "";
    render();
  }
}
async function loadTodos() {
  todos = await requestApi<Todo[]>("/api/todos");
  render();
}
$<HTMLButtonElement>("#auth-toggle").onclick = () => {
  authMode = authMode === "login" ? "register" : "login";
  const register = authMode === "register";
  $("#auth-heading").textContent = register ? "Buat akunmu." : "Masuk ke akunmu.";
  $("#auth-description").textContent = register ? "Daftar untuk mulai mencatat rencana harianmu." : "Simpan rencana harianmu dan lanjutkan kapan saja.";
  $("#name-field").hidden = !register;
  $<HTMLInputElement>("#auth-name").disabled = !register;
  $<HTMLInputElement>("#auth-name").required = register;
  $<HTMLInputElement>("#auth-password").autocomplete = register ? "new-password" : "current-password";
  $<HTMLInputElement>("#auth-password").value = "";
  $<HTMLButtonElement>("#auth-submit").textContent = register ? "Daftar" : "Masuk";
  $("#auth-switch-label").textContent = register ? "Sudah punya akun?" : "Belum punya akun?";
  $<HTMLButtonElement>("#auth-toggle").textContent = register ? "Masuk" : "Daftar sekarang";
  $("#auth-error").hidden = true;
  $(register ? "#auth-name" : "#auth-email").focus();
};
$("#auth-form").onsubmit = async (event) => {
  event.preventDefault();
  $<HTMLButtonElement>("#auth-submit").disabled = true;
  $<HTMLButtonElement>("#auth-toggle").disabled = true;
  $("#auth-error").hidden = true;
  try {
    const { user } = await requestApi<{ user: User }>(`/api/auth/${authMode}`, {
      method: "POST",
      body: JSON.stringify({ name: $<HTMLInputElement>("#auth-name").value, email: $<HTMLInputElement>("#auth-email").value, password: $<HTMLInputElement>("#auth-password").value }),
    });
    $<HTMLInputElement>("#auth-password").value = "";
    setUser(user);
    $("#error").hidden = true;
    await loadTodos().catch((error) => showError(error));
  } catch (error) {
    showError(error, "#auth-error");
  } finally {
    $<HTMLButtonElement>("#auth-submit").disabled = false;
    $<HTMLButtonElement>("#auth-toggle").disabled = false;
  }
};
$<HTMLButtonElement>("#logout").onclick = async () => {
  $<HTMLButtonElement>("#logout").disabled = true;
  try {
    await requestApi("/api/auth/logout", { method: "POST" });
    setUser(null);
    $("#auth-error").hidden = true;
    $<HTMLInputElement>("#auth-email").focus();
  } catch (error) {
    showError(error);
  } finally {
    $<HTMLButtonElement>("#logout").disabled = false;
  }
};
async function initialize() {
  $<HTMLButtonElement>("#auth-submit").disabled = true;
  $<HTMLButtonElement>("#auth-toggle").disabled = true;
  try {
    const { user } = await requestApi<{ user: User }>("/api/auth/me");
    setUser(user);
    await loadTodos().catch((error) => showError(error));
  } catch (error) {
    setUser(null);
    if (!(error instanceof ApiError) || error.status !== 401) showError(error, "#auth-error");
  } finally {
    $<HTMLButtonElement>("#auth-submit").disabled = false;
    $<HTMLButtonElement>("#auth-toggle").disabled = false;
  }
}
initialize();
