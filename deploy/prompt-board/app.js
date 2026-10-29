const $ = (id) => document.getElementById(id);
const start = new Set([
  "training.planetary.dummy",
  "training.planetary.target",
  "training.planetary.ki-node",
  "audio.development.dummy-hit",
  "audio.development.exam-success",
  "audio.development.ki-charge",
]);
let catalog = [],
  records = {},
  page = 0,
  busy = false,
  messageTimer;
const perPage = 12;
function say(message) {
  $("message").textContent = message;
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => ($("message").textContent = ""), 9000);
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
async function api(route, options = {}) {
  const res = await fetch("/prompty/api/" + route, options);
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) {
      $("login").hidden = false;
      $("board").hidden = true;
      $("logout").hidden = true;
    }
    throw Error(data.error || "Błąd serwera.");
  }
  return data;
}
function completed(p) {
  const r = records[p.id];
  if (!r || r.revision) return false;
  const current = r.files.filter((f) => !r.revisedAt || f.uploadedAt > r.revisedAt);
  return p.kind === "animation"
    ? current.some((f) => f.type === "application/zip") || current.length >= 8
    : current.length > 0;
}
function stateOf(p) {
  return records[p.id]?.revision ? "revision" : completed(p) ? "done" : "pending";
}
async function load() {
  const data = await api("prompts");
  catalog = data.catalog;
  records = data.state;
  $("login").hidden = true;
  $("board").hidden = false;
  $("logout").hidden = false;
  render();
}
function render() {
  const done = catalog.filter(completed).length;
  $("progress-label").textContent = `Zaliczone: ${done} / ${catalog.length} · zapisane na serwerze`;
  $("progress").max = catalog.length;
  $("progress").value = done;
  const search = $("search").value.trim().toLocaleLowerCase("pl");
  const filtered = catalog.filter(
    (p) =>
      ($("priority").value === "ALL" ||
        ($("priority").value === "START" ? start.has(p.id) : p.priority === $("priority").value)) &&
      ($("tool").value === "ALL" || p.tool.startsWith($("tool").value)) &&
      ($("race").value === "ALL" || p.race === $("race").value) &&
      ($("status").value === "ALL" || stateOf(p) === $("status").value) &&
      (!search ||
        [p.id, p.name, p.race, p.tool].some((s) => s.toLocaleLowerCase("pl").includes(search))),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  page = Math.min(page, pages - 1);
  $("list-count").textContent = `Prompty (${filtered.length})`;
  $("page-label").textContent = `${page + 1} / ${pages}`;
  $("previous").disabled = page === 0 || busy;
  $("next").disabled = page === pages - 1 || busy;
  $("empty").hidden = filtered.length !== 0;
  $("list").replaceChildren();
  for (const p of filtered.slice(page * perPage, (page + 1) * perPage)) {
    const card = node("article");
    card.dataset.prompt = p.id;
    const top = node("div", undefined, "card-top"),
      title = node("div");
    title.append(node("div", `${p.priority} · ${p.tool} · ${p.id}`, "meta"), node("h3", p.name));
    const status = stateOf(p),
      r = records[p.id],
      count = r?.files.filter((f) => !r.revisedAt || f.uploadedAt > r.revisedAt).length || 0;
    top.append(
      title,
      node(
        "span",
        status === "done"
          ? "✓ Zaliczony — wynik zapisany"
          : status === "revision"
            ? "Do poprawy"
            : p.kind === "animation"
              ? `Do zrobienia · ${count}/8 klatek lub ZIP`
              : "Do zrobienia",
        "badge " + status,
      ),
    );
    card.append(top, node("div", `${p.status} · Zależność: ${p.dependency}`, "dependency"));
    const text = node("textarea");
    text.value = p.prompt;
    text.readOnly = true;
    text.setAttribute("aria-label", "Prompt: " + p.name);
    card.append(text);
    const actions = node("div", undefined, "actions"),
      copy = node("button", "Kopiuj prompt");
    copy.disabled = busy;
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(p.prompt);
        say("Prompt skopiowany.");
      } catch {
        text.focus();
        text.select();
        say("Zaznaczono prompt — wybierz „Kopiuj”.");
      }
    };
    const input = node("input");
    input.type = "file";
    input.multiple = true;
    input.id = "file-" + p.id;
    input.className = "file-input";
    input.disabled = busy;
    input.accept =
      p.kind === "sfx" || p.kind === "ambience"
        ? ".wav,.mp3"
        : p.kind === "animation"
          ? ".png,.jpg,.jpeg,.webp,.zip"
          : ".png,.jpg,.jpeg,.webp";
    const label = node("label", busy ? "Zapisywanie…" : "↑ Wgraj wynik", "upload-label");
    label.htmlFor = input.id;
    input.onchange = () => upload(p, Array.from(input.files || []));
    actions.append(copy, input, label);
    if (r?.files.length) {
      const revise = node("button", "Oznacz do poprawy");
      revise.disabled = busy;
      revise.onclick = async () => {
        try {
          const result = await api("prompts/" + encodeURIComponent(p.id) + "/revision", {
            method: "POST",
          });
          records[p.id] = result.record;
          render();
          say("Oznaczono do poprawy. Poprzednie pliki zachowane.");
        } catch (e) {
          say(e.message);
        }
      };
      actions.append(revise);
    }
    card.append(
      actions,
      node(
        "p",
        p.kind === "animation"
          ? "8 osobnych klatek lub ZIP z klipem. ZIP jest przechowywany, ale jego zawartość nie jest automatycznie oceniana."
          : "Obraz: PNG/JPG/WebP · dźwięk: WAV/MP3 · maks. 48 MB na plik. Nowa wersja zachowuje poprzednią.",
        "hint",
      ),
    );
    if (r?.files.length) {
      const files = node("div", undefined, "files");
      for (const f of r.files) {
        const item = node("div", undefined, "file"),
          url = "/prompty/api/files/" + f.id;
        if (f.type.startsWith("image/")) {
          const img = node("img");
          img.src = url + "?preview";
          img.alt = f.name;
          img.loading = "lazy";
          item.append(img);
        }
        if (f.type.startsWith("audio/")) {
          const audio = node("audio");
          audio.src = url + "?preview";
          audio.controls = true;
          audio.preload = "none";
          item.append(audio);
        }
        const link = node("a", f.name);
        link.href = url;
        link.download = f.name;
        item.append(
          link,
          node(
            "small",
            `${(f.bytes / 1024 / 1024).toFixed(2)} MB · ${new Date(f.uploadedAt).toLocaleString("pl-PL")}`,
          ),
          node("small", "SHA-256: " + f.sha256.slice(0, 16) + "…"),
        );
        files.append(item);
      }
      card.append(files);
    }
    $("list").append(card);
  }
}
async function upload(p, files) {
  if (busy || !files.length) return;
  busy = true;
  render();
  let uploaded = 0;
  try {
    for (const file of files) {
      if (file.size > 48 * 1024 * 1024) throw Error(`${file.name}: przekroczono 48 MB.`);
      say(`Zapisywanie ${uploaded + 1}/${files.length}: ${file.name}`);
      const result = await api("prompts/" + encodeURIComponent(p.id) + "/upload", {
        method: "POST",
        headers: {
          "X-File-Name": encodeURIComponent(file.name),
          "Content-Type": "application/octet-stream",
        },
        body: file,
      });
      records[p.id] = result.record;
      uploaded++;
    }
    say(
      completed(p)
        ? "✓ Wynik zapisany na serwerze. Prompt zaliczony."
        : `Zapisano ${uploaded} plików. Dokończ komplet klatek.`,
    );
  } catch (e) {
    say(`${uploaded ? `Zapisano ${uploaded} plików. ` : ""}${e.message}`);
  } finally {
    busy = false;
    render();
  }
}
$("login-form").onsubmit = async (e) => {
  e.preventDefault();
  const button = e.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    await api("login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value, password: $("password").value }),
    });
    $("password").value = "";
    await load();
  } catch (e) {
    say(e.message);
  } finally {
    button.disabled = false;
  }
};
$("logout").onclick = async () => {
  try {
    await api("logout", { method: "POST" });
    records = {};
    catalog = [];
    $("list").replaceChildren();
    $("login").hidden = false;
    $("board").hidden = true;
    $("logout").hidden = true;
  } catch (e) {
    say(e.message);
  }
};
for (const id of ["search", "priority", "tool", "race", "status"])
  $(id).addEventListener(id === "search" ? "input" : "change", () => {
    page = 0;
    render();
  });
$("previous").onclick = () => {
  page--;
  render();
};
$("next").onclick = () => {
  page++;
  render();
};
$("export").onclick = () => {
  location.href = "/prompty/api/export";
};
load().catch((e) => {
  if (!e.message.startsWith("Zaloguj")) say(e.message);
});
