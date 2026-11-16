/* messages.js - friends-only messaging for vibin.
   Friends = two people who follow each other.
   Add this line to index.html, right before </body>:
     <script src="messages.js"></script>
*/
(function () {
  "use strict";

  var SUPABASE_URL = "https://fomasnzofymhafhomdux.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_2i35gbEiTyxxSG98TcDRjg_YeHnI3S_";
  var TICK_MS = 3000, MAX_LEN = 1000, MAX_IMG_MB = 10;
  // Optional: paste a free GIPHY API key (developers.giphy.com) to turn on GIF search.
  // Without a key the GIF tab lets people paste a GIF link instead.
  var GIPHY_KEY = "NePCSITZ6MJKq9L7M51qMq5kPKHd9T9M";
  var EMOJI = "😀 😃 😄 😁 😆 😅 😂 🤣 🙂 😉 😊 😍 🥰 😘 😋 😎 🤩 🥳 😏 😢 😭 😤 😡 🤯 😱 🤔 🙄 😴 🤗 🫡 👍 👎 👏 🙌 🙏 💪 👀 💯 🔥 ✨ 💖 ❤️ 🧡 💛 💚 💙 💜 🖤 🎉 🎂 🍕 🍔 🍟 🍿 ☕ 🎮 🎵 ⚽ 🐶 🐱 🦄 🌈 ☀️ 🌙 ⭐".split(" ");
  var STICKERS = "🐶 🐱 🦄 🐼 🦊 🐸 🐵 🐧 🦖 👻 🤖 👽 💩 🎃 🍕 🍩 🚀 🌈 🔥 💖 🎉 👑 🧸 🌮".split(" ");
  var QUICK = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

  var S = {
    me: null, token: null, friends: new Map(), names: new Map(), convos: [], unread: 0,
    cur: null, thread: [], sig: "", open: false, broken: false, ticks: 0, react: {}, call: null, myCh: null, myChFor: null, ptab: "Emoji"
  };
  var ui = {};

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var PATHS = {
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/>'
  };
  function svg(name, size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + PATHS[name] + '</svg>';
  }
  function hue(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function avatar(name, size) {
    name = name || "?";
    var d = el("div", "av", name.charAt(0).toUpperCase());
    d.style.width = d.style.height = size + "px";
    d.style.fontSize = Math.round(size * 0.42) + "px";
    d.style.background = "linear-gradient(135deg,hsl(" + hue(name) + ",75%,60%),hsl(" + ((hue(name) + 50) % 360) + ",70%,45%))";
    return d;
  }
  function toast(msg) {
    var t = $("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 3000);
  }
  function stamp(iso) {
    var d = new Date(iso), n = new Date();
    var hm = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === n.toDateString()) return hm;
    return d.toLocaleDateString([], { day: "numeric", month: "short" }) + " " + hm;
  }
  function shortTime(iso) {
    var d = new Date(iso), n = new Date();
    if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  }
  function noop() {}
  function fail(e) {
    if (/schema cache|does not exist|could not find|PGRST20|relation/i.test((e && e.message) || "")) S.broken = true;
  }
  function pauseVideos() { document.querySelectorAll("video").forEach(function (v) { try { v.pause(); } catch (e) {} }); }
  function openLogin() { var b = document.querySelector("#authArea button.btn"); if (b) b.click(); }

  /* ---------- session (shared with the main script through localStorage) ---------- */
  function readSession() {
    var found = null;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && /^sb-.+-auth-token$/.test(k)) {
          var s = JSON.parse(localStorage.getItem(k) || "null");
          if (s && s.access_token && s.user && s.user.id) { found = s; break; }
        }
      }
    } catch (e) {}
    var uid = found ? found.user.id : null;
    S.token = found ? found.access_token : null;
    if (uid !== S.me) {
      S.me = uid; S.friends = new Map(); S.convos = []; S.unread = 0; S.cur = null; S.thread = []; S.sig = ""; S.broken = false;
      if (ui.root) { ui.root.classList.remove("vm-open"); buildChatShell(); }
      return true;
    }
    return false;
  }

  /* ---------- API ---------- */
  function api(path, opt) {
    readSession();
    if (!S.token) return Promise.reject(new Error("not logged in"));
    opt = opt || {};
    var headers = { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + S.token, "Content-Type": "application/json" };
    if (opt.prefer) headers.Prefer = opt.prefer;
    return fetch(SUPABASE_URL + "/rest/v1/" + path, {
      method: opt.method || "GET", headers: headers, body: opt.body ? JSON.stringify(opt.body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) { var err = new Error((j && (j.message || j.hint)) || ("HTTP " + r.status)); err.code = j && j.code; throw err; }
        return j;
      });
    });
  }
  var COLS = "id,sender_id,receiver_id,body,created_at,read_at,kind,media_url";
  function isBlocked(id) { return !!(window.vibin && window.vibin.state.blocked.has(id)); }

  function isAdmin() { return !!(window.vibin && window.vibin.state && window.vibin.state.isAdmin); }
  /* friends, admins (can message anyone), and people an admin has already written to (they can reply) */
  function canMsg(pid) {
    if (S.friends.has(pid) || isAdmin()) return true;
    return !!(S.admins && S.admins.has(pid) && S.thread.some(function (x) { return x.sender_id === pid; }));
  }
  function loadAdmins() {
    return api("rpc/admin_ids", { method: "POST", body: {} }).then(function (rows) {
      S.admins = new Set((rows || []).map(function (r) { return typeof r === "string" ? r : (r.admin_ids || r); }));
    }).catch(function () { S.admins = new Set(); });
  }
  function loadFriends() {
    loadAdmins();
    return api("rpc/my_friends", { method: "POST", body: {} }).then(function (rows) {
      var m = new Map();
      (rows || []).forEach(function (r) { m.set(r.id, r.username); S.names.set(r.id, r.username); });
      S.friends = m;
    }).catch(fail);
  }
  function loadConvos() {
    return api("messages?select=" + COLS + "&order=created_at.desc&limit=400").then(function (rows) {
      var by = new Map(), unread = 0;
      (rows || []).forEach(function (m) {
        var pid = m.sender_id === S.me ? m.receiver_id : m.sender_id;
        var c = by.get(pid);
        if (!c) { c = { pid: pid, last: m, unread: 0 }; by.set(pid, c); }
        if (m.receiver_id === S.me && !m.read_at) { c.unread++; unread++; }
      });
      S.convos = Array.from(by.values()).filter(function (c) { return !isBlocked(c.pid); });
      S.unread = S.convos.reduce(function (a, c) { return a + c.unread; }, 0);
      var missing = S.convos.map(function (c) { return c.pid; }).filter(function (id) { return !S.names.has(id); });
      if (!missing.length) return;
      return api("profiles?select=id,username&id=in.(" + missing.join(",") + ")").then(function (ps) {
        (ps || []).forEach(function (p) { S.names.set(p.id, p.username); });
      });
    });
  }
  function loadThread(pid) {
    var me = S.me;
    var q = "messages?select=" + COLS +
      "&or=(and(sender_id.eq." + me + ",receiver_id.eq." + pid + "),and(sender_id.eq." + pid + ",receiver_id.eq." + me + "))" +
      "&order=created_at.desc&limit=200";
    return api(q).then(function (rows) {
      rows = (rows || []).reverse();
      var ids = rows.filter(function (m) { return m.id; }).map(function (m) { return m.id; });
      if (!ids.length) { S.react = {}; return rows; }
      return api("message_reactions?select=message_id,user_id,emoji&message_id=in.(" + ids.join(",") + ")").then(function (rs) {
        var by = {}; (rs || []).forEach(function (r) { (by[r.message_id] = by[r.message_id] || []).push(r); });
        S.react = by; return rows;
      }).catch(function () { S.react = {}; return rows; });
    });
  }
  function markRead(pid) {
    return api("messages?receiver_id=eq." + S.me + "&sender_id=eq." + pid + "&read_at=is.null",
      { method: "PATCH", body: { read_at: new Date().toISOString() }, prefer: "return=minimal" }).catch(noop);
  }

  /* ---------- badge ---------- */
  function updateBadge() {
    document.querySelectorAll(".vm-nb").forEach(function (b) {
      if (S.unread > 0) { b.textContent = S.unread > 9 ? "9+" : String(S.unread); b.style.display = "grid"; }
      else b.style.display = "none";
    });
  }
  function refreshConvos() {
    if (!S.me) { updateBadge(); return Promise.resolve(); }
    return loadConvos().then(function () { updateBadge(); if (S.open) renderList(); }).catch(fail);
  }

  /* ---------- panel UI ---------- */
  function emptyBlock(title, text, btnText, btnFn) {
    var w = el("div", "vm-empty");
    w.appendChild(el("b", null, title));
    if (text) w.appendChild(el("p", null, text));
    if (btnText) { var b = el("button", "btn", btnText); b.addEventListener("click", btnFn); w.appendChild(b); }
    return w;
  }
  function section(box, title) { box.appendChild(el("div", "vm-sec", title)); }
  function row(pid, name, preview, previewUnread, time, unread) {
    var b = el("button", "vm-row" + (S.cur && S.cur.id === pid ? " on" : ""));
    b.appendChild(avatar(name, 44));
    var t = el("div", "t");
    t.appendChild(el("div", "n", "@" + name));
    t.appendChild(el("div", "p" + (previewUnread ? " unread" : ""), preview));
    b.appendChild(t);
    var r = el("div", "vm-r");
    if (time) r.appendChild(el("span", "vm-time", time));
    if (unread) r.appendChild(el("span", "vm-dot", unread > 9 ? "9+" : String(unread)));
    b.appendChild(r);
    b.addEventListener("click", function () { openThread(pid, name); });
    return b;
  }
  function renderList() {
    var box = ui.listBody; if (!box) return;
    box.textContent = "";
    if (!S.me) { box.appendChild(emptyBlock("Log in to message your friends", "Friends are people who follow you back.", "Log in", openLogin)); return; }
    if (S.broken) { box.appendChild(emptyBlock("Messaging is not set up yet", "Run messages.sql in the Supabase SQL editor, then refresh this page.")); return; }
    if (!S.convos.length && !S.friends.size) {
      box.appendChild(emptyBlock("No friends yet", "Follow someone. When they follow you back, you become friends and can message each other."));
      return;
    }
    if (S.convos.length) {
      section(box, "Chats");
      S.convos.forEach(function (c) {
        var name = S.names.get(c.pid) || "user";
        var mine = c.last.sender_id === S.me;
        box.appendChild(row(c.pid, name, (mine ? "You: " : "") + c.last.body, c.unread > 0, shortTime(c.last.created_at), c.unread));
      });
    }
    var inChat = {}; S.convos.forEach(function (c) { inChat[c.pid] = true; });
    var fresh = Array.from(S.friends.entries()).filter(function (e) { return !inChat[e[0]]; });
    if (fresh.length) {
      section(box, "Friends");
      fresh.forEach(function (e) { box.appendChild(row(e[0], e[1], "Say hi", false, "", 0)); });
    }
  }

  function buildChatShell() {
    var c = ui.chat; if (!c) return;
    c.textContent = "";
    if (!S.cur) { c.appendChild(emptyBlock("Your messages", "Pick a friend on the left to start chatting.")); return; }
    var name = S.cur.name;
    var head = el("div", "vm-chead");
    var back = el("button", "vm-x vm-back"); back.setAttribute("aria-label", "Back"); back.innerHTML = svg("back", 22);
    back.addEventListener("click", closeThread);
    head.appendChild(back);
    head.appendChild(avatar(name, 38));
    var nm = el("a", "vm-name", "@" + name); nm.href = "#/u/" + encodeURIComponent(name);
    nm.addEventListener("click", closePanel);
    head.appendChild(nm);
    nm.style.flex = "1";
    function hb(icon, label, fn) {
      var b = el("button", "vm-x"); b.type = "button"; b.title = label; b.setAttribute("aria-label", label);
      b.innerHTML = svg(icon, 20); b.addEventListener("click", fn); head.appendChild(b);
    }
    hb("phone", "Voice call", function () { startCall(S.cur.id, S.cur.name, false); });
    hb("video", "Video call", function () { startCall(S.cur.id, S.cur.name, true); });
    hb("ban", "Block", blockCur);
    c.appendChild(head);

    ui.msgs = el("div", "vm-msgs"); c.appendChild(ui.msgs);
    ui.note = el("div", "vm-note"); ui.note.style.display = "none"; c.appendChild(ui.note);

    ui.pick = el("div", "vm-pick"); ui.pick.style.display = "none"; c.appendChild(ui.pick);
    var form = el("form", "vm-form"); form.autocomplete = "off";
    ui.input = document.createElement("input"); ui.input.type = "text"; ui.input.maxLength = MAX_LEN; ui.input.placeholder = "Message @" + name;
    ui.send = el("button"); ui.send.type = "submit"; ui.send.setAttribute("aria-label", "Send"); ui.send.innerHTML = svg("send", 20);
    function ib(icon, label, fn) { var b = el("button", "vm-ib"); b.type = "button"; b.title = label; b.setAttribute("aria-label", label); b.innerHTML = svg(icon, 22); b.addEventListener("click", fn); return b; }
    ui.file = document.createElement("input"); ui.file.type = "file"; ui.file.accept = "image/*"; ui.file.hidden = true;
    ui.file.addEventListener("change", function () { if (ui.file.files[0]) sendImage(ui.file.files[0]); ui.file.value = ""; });
    form.appendChild(ib("smile", "Emoji, stickers and GIFs", togglePick));
    form.appendChild(ib("image", "Send a picture", function () { ui.file.click(); }));
    form.appendChild(ui.file);
    form.appendChild(ui.input); form.appendChild(ui.send);
    form.addEventListener("submit", function (e) { e.preventDefault(); sendMessage(); });
    c.appendChild(form);
  }
  function updateComposer() {
    if (!S.cur || !ui.input) return;
    var ok = canMsg(S.cur.id);
    ui.input.disabled = !ok; ui.send.disabled = !ok;
    ui.note.style.display = ok ? "none" : "block";
    ui.note.textContent = "You are no longer friends with @" + S.cur.name + ". Follow each other again to keep chatting.";
  }
  function renderMsgs(forceBottom) {
    var box = ui.msgs; if (!box) return;
    var atBottom = forceBottom || box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    box.textContent = "";
    if (!S.thread.length) box.appendChild(el("div", "vm-empty", "Say hi to @" + S.cur.name + "!"));
    var lastMine = -1;
    S.thread.forEach(function (m, i) { if (m.sender_id === S.me) lastMine = i; });
    var prev = 0;
    S.thread.forEach(function (m, i) {
      var t = new Date(m.created_at).getTime();
      if (!prev || t - prev > 30 * 60 * 1000) box.appendChild(el("div", "vm-t", stamp(m.created_at)));
      prev = t;
      box.appendChild(msgNode(m));
      if (i === lastMine) box.appendChild(el("div", "vm-seen", m.pending ? "Sending..." : (m.read_at ? "Seen" : "Sent")));
    });
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  function openThread(pid, name) {
    S.cur = { id: pid, name: name }; S.names.set(pid, name); S.thread = []; S.sig = "";
    ui.root.classList.add("vm-open");
    buildChatShell(); updateComposer(); renderList();
    refreshThread(true);
    if (ui.input && !ui.input.disabled) setTimeout(function () { try { ui.input.focus(); } catch (e) {} }, 50);
  }
  function closeThread() {
    S.cur = null; S.thread = []; S.sig = "";
    ui.root.classList.remove("vm-open");
    buildChatShell(); renderList();
  }
  function refreshThread(first) {
    var cur = S.cur; if (!cur) return Promise.resolve();
    return loadThread(cur.id).then(function (rows) {
      if (!S.cur || S.cur.id !== cur.id) return;
      var sig = rows.map(function (m) { return m.id + (m.read_at ? "r" : "") + (S.react[m.id] || []).map(function (r) { return r.user_id.slice(0, 4) + r.emoji; }).join(""); }).join("|");
      if (first || sig !== S.sig) { S.sig = sig; S.thread = rows; renderMsgs(first); }
      var incoming = rows.some(function (m) { return m.receiver_id === S.me && !m.read_at; });
      if (incoming) markRead(cur.id).then(refreshConvos);
    }).catch(noop);
  }
  function sendRaw(p) {
    if (!S.cur || !S.me) return;
    var pid = S.cur.id;
    if (!canMsg(pid)) { toast("You can only message friends"); return; }
    var tmp = { id: "tmp" + Date.now(), sender_id: S.me, receiver_id: pid, body: p.body.slice(0, MAX_LEN), kind: p.kind || "text", media_url: p.media_url || null, created_at: new Date().toISOString(), read_at: null, pending: true };
    S.thread.push(tmp); renderMsgs(true);
    api("messages", { method: "POST", body: { sender_id: S.me, receiver_id: pid, body: tmp.body, kind: tmp.kind, media_url: tmp.media_url }, prefer: "return=representation" })
      .then(function () { return refreshThread(true).then(refreshConvos); })
      .catch(function (e) {
        S.thread = S.thread.filter(function (m) { return m.id !== tmp.id; });
        if (S.cur && S.cur.id === pid) { renderMsgs(true); if (tmp.kind === "text" && ui.input) ui.input.value = tmp.body; }
        var bn = window.vibin && window.vibin.state && window.vibin.state.ban;
        toast(bn ? "Your account is restricted, so you cannot send messages." : "Could not send. You can only message friends.");
        fail(e);
      });
  }
  function sendMessage() {
    var text = ui.input.value.trim(); if (!text) return;
    ui.input.value = ""; sendRaw({ body: text });
  }
  function sendImage(file) {
    if (!S.cur || !S.me) return;
    if (!/^image\//.test(file.type)) { toast("Please choose a picture"); return; }
    if (file.size > MAX_IMG_MB * 1024 * 1024) { toast("That picture is over " + MAX_IMG_MB + " MB"); return; }
    var pid = S.cur.id;
    if (!canMsg(pid)) { toast("You can only message friends"); return; }
    var ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    var path = S.me + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
    toast("Sending picture...");
    fetch(SUPABASE_URL + "/storage/v1/object/chat/" + path, {
      method: "POST", body: file,
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + S.token, "Content-Type": file.type, "x-upsert": "false" }
    }).then(function (r) {
      if (!r.ok) throw new Error("upload");
      if (!S.cur || S.cur.id !== pid) return;
      sendRaw({ body: file.type === "image/gif" ? "GIF" : "Photo", kind: file.type === "image/gif" ? "gif" : "image", media_url: SUPABASE_URL + "/storage/v1/object/public/chat/" + path });
    }).catch(function () { toast("Could not upload the picture. Run features.sql first."); });
  }

  /* ---------- bubbles, reactions ---------- */
  function msgNode(m) {
    var mine = m.sender_id === S.me;
    var w = el("div", "vm-w " + (mine ? "me" : "them")), row = el("div", "vm-wr"), b;
    if ((m.kind === "image" || m.kind === "gif") && /^https:\/\//.test(m.media_url || "")) {
      b = el("div", "vm-b vm-media");
      var im = document.createElement("img"); im.src = m.media_url; im.loading = "lazy"; im.alt = m.kind;
      im.addEventListener("click", function () { window.open(m.media_url, "_blank", "noopener"); });
      b.appendChild(im);
    } else if (m.kind === "sticker") b = el("div", "vm-sticker", m.body);
    else b = el("div", "vm-b " + (mine ? "me" : "them"), m.body);
    row.appendChild(b);
    if (!m.pending) {
      var rb = el("button", "vm-rb"); rb.type = "button"; rb.setAttribute("aria-label", "React"); rb.innerHTML = svg("smile", 16);
      rb.addEventListener("click", function () {
        var old = w.querySelector(".vm-bar"); if (old) { old.remove(); return; }
        var bar = el("div", "vm-bar");
        QUICK.forEach(function (e) { var x = el("button", null, e); x.type = "button"; x.addEventListener("click", function () { bar.remove(); react(m, e); }); bar.appendChild(x); });
        row.after(bar);
      });
      row.appendChild(rb);
    }
    w.appendChild(row);
    var rs = S.react[m.id] || [];
    if (rs.length) {
      var counts = {}; rs.forEach(function (r) { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
      var chips = el("div", "vm-chips");
      Object.keys(counts).forEach(function (e) {
        var on = rs.some(function (r) { return r.emoji === e && r.user_id === S.me; });
        var c = el("button", "vm-chip" + (on ? " on" : ""), e + " " + counts[e]); c.type = "button";
        c.addEventListener("click", function () { react(m, e); }); chips.appendChild(c);
      });
      w.appendChild(chips);
    }
    return w;
  }
  function react(m, e) {
    var mineR = (S.react[m.id] || []).filter(function (r) { return r.user_id === S.me; })[0];
    var p = api("message_reactions?message_id=eq." + m.id + "&user_id=eq." + S.me, { method: "DELETE", prefer: "return=minimal" });
    if (!mineR || mineR.emoji !== e) p = p.then(function () { return api("message_reactions", { method: "POST", body: { message_id: m.id, user_id: S.me, emoji: e }, prefer: "return=minimal" }); });
    p.then(function () { return refreshThread(); }).catch(function (x) { toast("Could not react. Run features.sql first."); fail(x); });
  }

  /* ---------- emoji / sticker / GIF picker ---------- */
  function closePick() { if (ui.pick) ui.pick.style.display = "none"; }
  function togglePick() {
    if (!ui.pick) return;
    if (ui.pick.style.display === "none") { ui.pick.style.display = "block"; renderPick(S.ptab); } else closePick();
  }
  function renderPick(tab) {
    S.ptab = tab; var p = ui.pick; p.textContent = "";
    var tabs = el("div", "vm-ptabs");
    ["Emoji", "Stickers", "GIFs"].forEach(function (t) { var b = el("button", t === tab ? "on" : "", t); b.type = "button"; b.addEventListener("click", function () { renderPick(t); }); tabs.appendChild(b); });
    p.appendChild(tabs);
    var body = el("div", "vm-pbody" + (tab === "Stickers" ? " st" : "")); p.appendChild(body);
    if (tab === "Emoji") EMOJI.forEach(function (e) { var b = el("button", "vm-em", e); b.type = "button"; b.addEventListener("click", function () { ui.input.value += e; ui.input.focus(); }); body.appendChild(b); });
    else if (tab === "Stickers") STICKERS.forEach(function (e) { var b = el("button", "vm-em", e); b.type = "button"; b.addEventListener("click", function () { sendRaw({ body: e, kind: "sticker" }); closePick(); }); body.appendChild(b); });
    else gifTab(body);
  }
  function gifTab(body) {
    var bar = el("div", "vm-gin"), inp = document.createElement("input"), go = el("button", "btn sm", GIPHY_KEY ? "Search" : "Send");
    inp.placeholder = GIPHY_KEY ? "Search GIFs" : "Paste a GIF link (https://...)"; go.type = "button";
    bar.appendChild(inp); bar.appendChild(go); body.appendChild(bar);
    if (!GIPHY_KEY) {
      go.addEventListener("click", function () {
        var u = inp.value.trim();
        if (!/^https:\/\/\S+$/.test(u)) { toast("Paste a link that starts with https://"); return; }
        sendRaw({ body: "GIF", kind: "gif", media_url: u }); closePick();
      });
      return;
    }
    var grid = el("div", "vm-gifs"); body.appendChild(grid);
    function load() {
      var q = inp.value.trim();
      fetch("https://api.giphy.com/v1/gifs/" + (q ? "search?q=" + encodeURIComponent(q) + "&" : "trending?") + "limit=24&rating=pg-13&api_key=" + GIPHY_KEY)
        .then(function (r) { return r.json(); }).then(function (j) {
          grid.textContent = "";
          (j.data || []).forEach(function (g) {
            var im = document.createElement("img"); im.src = g.images.fixed_height_small.url; im.alt = "GIF";
            im.addEventListener("click", function () { sendRaw({ body: "GIF", kind: "gif", media_url: g.images.fixed_height.url }); closePick(); });
            grid.appendChild(im);
          });
        }).catch(function () { toast("Could not load GIFs"); });
    }
    go.addEventListener("click", load); inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); load(); } });
    load();
  }

  /* ---------- block ---------- */
  function blockCur() {
    if (!S.cur) return;
    var id = S.cur.id, name = S.cur.name;
    if (!confirm("Block @" + name + "? You will stop being friends and neither of you can message or call the other.")) return;
    api("rpc/block_user", { method: "POST", body: { target: id } }).then(function () {
      if (window.vibin) { window.vibin.state.blocked.add(id); window.vibin.state.following.delete(id); }
      toast("Blocked @" + name); closeThread(); return loadAll();
    }).catch(function (e) { toast("Could not block. Run features.sql first."); fail(e); });
  }

  /* ---------- calls (WebRTC, signalled over Supabase Realtime) ---------- */
  var ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }] };
  function SB() { return window.vibin && window.vibin.sb; }
  function myName() { var u = window.vibin && window.vibin.state.user; return u ? u.name : "friend"; }
  function csend(pl) { var c = S.call; if (c && c.ch) { pl.from = S.me; c.ch.send({ type: "broadcast", event: "sig", payload: pl }); } }
  function peerCh(c) {
    c.ch = SB().channel("vcall-" + c.pid);
    c.ready = new Promise(function (res) { c.ch.subscribe(function (st) { if (st === "SUBSCRIBED") res(); }); });
  }
  function busyBye(pid) {
    var ch = SB().channel("vcall-" + pid);
    ch.subscribe(function (st) { if (st === "SUBSCRIBED") { ch.send({ type: "broadcast", event: "sig", payload: { t: "bye", from: S.me } }); setTimeout(function () { SB().removeChannel(ch); }, 600); } });
  }
  function cstatus(t) { if (S.call && S.call.st) S.call.st.textContent = t; }
  function callUI() {
    var c = S.call, o = $("vcall"); if (o) o.remove();
    o = el("div", "vc"); o.id = "vcall";
    c.rv = document.createElement("video"); c.rv.className = "vc-remote"; c.rv.autoplay = true; c.rv.setAttribute("playsinline", "");
    c.lv = document.createElement("video"); c.lv.className = "vc-local"; c.lv.autoplay = true; c.lv.muted = true; c.lv.setAttribute("playsinline", ""); c.lv.style.display = "none";
    var top = el("div", "vc-top"); top.appendChild(avatar(c.name, 84)); top.appendChild(el("div", "vc-n", "@" + c.name));
    c.st = el("div", "vc-s", ""); top.appendChild(c.st);
    c.bar = el("div", "vc-bar");
    o.appendChild(c.rv); o.appendChild(c.lv); o.appendChild(top); o.appendChild(c.bar); document.body.appendChild(o);
    callBar();
  }
  function cbtn(label, cls, fn) { var b = el("button", cls, label); b.type = "button"; b.addEventListener("click", fn); S.call.bar.appendChild(b); return b; }
  function callBar() {
    var c = S.call; c.bar.textContent = "";
    if (c.dir === "in" && !c.pc) { cbtn("Accept", "go", acceptCall); cbtn("Decline", "end", function () { endCall(true); }); return; }
    var mb = cbtn("Mute", "", function () { toggleTrack("getAudioTracks", mb, "Mute", "Unmute"); });
    if (c.video) { var vb = cbtn("Camera off", "", function () { toggleTrack("getVideoTracks", vb, "Camera off", "Camera on"); }); }
    cbtn("End", "end", function () { endCall(true); });
  }
  function toggleTrack(kind, btn, a, b) {
    var c = S.call; if (!c || !c.local) return; var on = true;
    c.local[kind]().forEach(function (t) { t.enabled = !t.enabled; on = t.enabled; });
    btn.textContent = on ? a : b;
  }
  function getMedia(v) { return navigator.mediaDevices.getUserMedia({ audio: true, video: v }); }
  function makePC() {
    var c = S.call, pc = new RTCPeerConnection(ICE); c.pc = pc;
    pc.onicecandidate = function (e) { if (e.candidate) csend({ t: "ice", c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.ontrack = function (e) { c.rv.srcObject = e.streams[0]; };
    pc.onconnectionstatechange = function () {
      if (pc.connectionState === "connected") { c.connected = true; clearTimeout(c.timer); cstatus("Connected"); }
      else if (pc.connectionState === "failed") { if (S.call === c) { toast("Call failed. A network may be blocking it."); endCall(false); } }
    };
    c.local.getTracks().forEach(function (t) { pc.addTrack(t, c.local); });
  }
  function flush() { var c = S.call; if (!c || !c.pc) return; c.pend.splice(0).forEach(function (x) { c.pc.addIceCandidate(x).catch(noop); }); }
  function startCall(pid, name, video) {
    if (!SB() || !window.RTCPeerConnection) { toast("Calls are not supported in this browser"); return; }
    if (S.call) { toast("You are already in a call"); return; }
    if (!S.friends.has(pid)) { toast("You can only call friends"); return; }
    var c = S.call = { pid: pid, name: name, video: video, dir: "out", pend: [] };
    callUI(); cstatus("Calling..."); peerCh(c);
    c.timer = setTimeout(function () { if (S.call === c && !c.connected) { toast("No answer"); endCall(true); } }, 40000);
    getMedia(video).then(function (s) {
      if (S.call !== c) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      c.local = s; if (video) { c.lv.srcObject = s; c.lv.style.display = ""; }
      makePC();
      return c.pc.createOffer().then(function (o) { return c.pc.setLocalDescription(o); }).then(function () { return c.ready; }).then(function () {
        var d = c.pc.localDescription; csend({ t: "offer", name: myName(), video: video, sdp: { type: d.type, sdp: d.sdp } });
      });
    }).catch(function () { if (S.call === c) { toast("Could not start the call. Allow microphone and camera access."); endCall(false); } });
  }
  function acceptCall() {
    var c = S.call; if (!c) return; cstatus("Connecting...");
    getMedia(c.video).then(function (s) {
      c.local = s; if (c.video) { c.lv.srcObject = s; c.lv.style.display = ""; }
      makePC(); callBar();
      return c.pc.setRemoteDescription(c.offer);
    }).then(function () { flush(); return c.pc.createAnswer(); })
      .then(function (a) { return c.pc.setLocalDescription(a); })
      .then(function () { return c.ready; })
      .then(function () { var d = c.pc.localDescription; csend({ t: "answer", sdp: { type: d.type, sdp: d.sdp } }); })
      .catch(function () { if (S.call === c) { toast("Could not answer. Allow microphone and camera access."); endCall(true); } });
  }
  function endCall(notify) {
    var c = S.call; if (!c) return;
    if (notify) csend({ t: "bye" });
    S.call = null; clearTimeout(c.timer);
    if (c.local) c.local.getTracks().forEach(function (t) { t.stop(); });
    try { if (c.pc) c.pc.close(); } catch (e) {}
    if (c.ch) setTimeout(function () { SB().removeChannel(c.ch); }, 600);
    var o = $("vcall"); if (o) o.remove();
  }
  function onSig(p) {
    if (!p || !p.t || !p.from) return;
    var c = S.call;
    if (p.t === "offer") {
      if (!S.friends.has(p.from) || isBlocked(p.from)) return;
      if (c) { busyBye(p.from); return; }
      c = S.call = { pid: p.from, name: S.names.get(p.from) || p.name || "friend", video: !!p.video, dir: "in", pend: [], offer: p.sdp };
      callUI(); cstatus("Incoming " + (c.video ? "video" : "voice") + " call"); peerCh(c);
      c.timer = setTimeout(function () { if (S.call === c && !c.connected) endCall(true); }, 40000);
      return;
    }
    if (!c || c.pid !== p.from) return;
    if (p.t === "bye") { toast("Call ended"); endCall(false); }
    else if (p.t === "answer" && c.pc) { c.pc.setRemoteDescription(p.sdp).then(flush).catch(noop); }
    else if (p.t === "ice") { if (c.pc && c.pc.remoteDescription) c.pc.addIceCandidate(p.c).catch(noop); else c.pend.push(p.c); }
  }
  function ensureCallCh() {
    var sb = SB(); if (!sb) return;
    if (!S.me) { if (S.myCh) { sb.removeChannel(S.myCh); S.myCh = null; S.myChFor = null; } return; }
    if (S.myCh && S.myChFor === S.me) return;
    if (S.myCh) sb.removeChannel(S.myCh);
    S.myChFor = S.me;
    S.myCh = sb.channel("vcall-" + S.me).on("broadcast", { event: "sig" }, function (m) { onSig(m.payload); }).subscribe();
  }

  function loadAll() {
    readSession();
    if (!S.me) { renderList(); updateBadge(); return Promise.resolve(); }
    return Promise.all([loadFriends(), loadConvos()]).then(function () {
      renderList(); updateBadge(); updateComposer();
    }).catch(function (e) { fail(e); renderList(); });
  }
  function openPanel() {
    S.open = true; pauseVideos();
    ui.root.classList.add("show");
    renderList(); buildChatShell();
    loadAll();
  }
  function closePanel() {
    S.open = false;
    ui.root.classList.remove("show");
  }

  /* ---------- build everything ---------- */
  function injectStyles() {
    var css = [
      ".vm{position:absolute;inset:0;z-index:30;background:var(--bg);display:none}",
      ".vm.show{display:flex}",
      ".vm-list{width:340px;border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0;flex:none}",
      ".vm-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--line);font-weight:800;font-size:1.2rem}",
      ".vm-x{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;flex:none}",
      ".vm-x:hover{background:var(--panel2)}",
      ".vm-scroll{flex:1;overflow-y:auto}",
      ".vm-sec{font-size:.8rem;color:var(--muted);font-weight:700;margin:14px 18px 6px}",
      ".vm-row{display:flex;align-items:center;gap:12px;padding:10px 18px;width:100%;text-align:left}",
      ".vm-row:hover,.vm-row.on{background:var(--panel2)}",
      ".vm-row .t{flex:1;min-width:0}",
      ".vm-row .n{font-weight:700}",
      ".vm-row .p{color:var(--muted);font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".vm-row .p.unread{color:var(--text);font-weight:700}",
      ".vm-r{display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex:none}",
      ".vm-time{font-size:.72rem;color:var(--muted)}",
      ".vm-dot,.vm-nb{min-width:20px;height:20px;border-radius:10px;background:var(--like);color:#fff;font-size:.72rem;font-weight:800;display:grid;place-items:center;padding:0 5px}",
      ".vm-nb{display:none;margin-left:auto}",
      ".bottom .vm-nb{position:absolute;top:2px;margin-left:16px;min-width:16px;height:16px;font-size:.62rem;padding:0 4px}",
      ".bottom .nav{position:relative}",
      ".vm-chat{flex:1;display:flex;flex-direction:column;min-width:0}",
      ".vm-chead{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--line)}",
      ".vm-back{display:none}",
      ".vm-name{font-weight:800;font-size:1.05rem}",
      ".vm-name:hover{text-decoration:underline}",
      ".vm-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:6px}",
      ".vm-b{max-width:75%;padding:9px 14px;border-radius:18px;line-height:1.4;overflow-wrap:anywhere;white-space:pre-wrap}",
      ".vm-b.me{align-self:flex-end;background:linear-gradient(90deg,var(--accent),var(--accent2));color:#fff;border-bottom-right-radius:6px}",
      ".vm-b.them{align-self:flex-start;background:var(--panel2);border-bottom-left-radius:6px}",
      ".vm-t{font-size:.72rem;color:var(--muted);align-self:center;margin:10px 0 2px}",
      ".vm-seen{font-size:.7rem;color:var(--muted);align-self:flex-end;margin-right:4px}",
      ".vm-note{padding:12px 16px;text-align:center;color:var(--muted);font-size:.9rem;border-top:1px solid var(--line)}",
      ".vm-form{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--line)}",
      ".vm-form input{flex:1;min-width:0;background:var(--panel2);border:1px solid transparent;border-radius:999px;padding:11px 16px;outline:none}",
      ".vm-form input:focus{border-color:var(--accent2)}",
      ".vm-form input:disabled{opacity:.5}",
      ".vm-form button{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:grid;place-items:center;color:#fff;flex:none}",
      ".vm-form button:disabled{opacity:.5}",
      ".vm-empty{margin:auto;text-align:center;color:var(--muted);padding:24px;max-width:340px;line-height:1.5;display:flex;flex-direction:column;align-items:center;gap:10px}",
      ".vm-empty b{color:var(--text);font-size:1.1rem}",
      "@media (max-width:760px){",
      ".vm-list{width:100%;border-right:0}",
      ".vm-chat{display:none}",
      ".vm.vm-open .vm-list{display:none}",
      ".vm.vm-open .vm-chat{display:flex}",
      ".vm-back{display:grid}",
      "}"
    ].join("\n");
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  }

  function injectStyles2() {
    var css = [
      ".vm-w{display:flex;flex-direction:column;max-width:78%}",
      ".vm-w.me{align-self:flex-end;align-items:flex-end}.vm-w.them{align-self:flex-start;align-items:flex-start}",
      ".vm-wr{display:flex;align-items:center;gap:4px;max-width:100%}.vm-w.me .vm-wr{flex-direction:row-reverse}",
      ".vm-w .vm-b{max-width:100%}",
      ".vm-media{padding:3px;background:var(--panel2)}.vm-media img{display:block;max-width:240px;max-height:280px;border-radius:15px;cursor:pointer}",
      ".vm-sticker{font-size:64px;line-height:1.1}",
      ".vm-rb{opacity:0;width:26px;height:26px;border-radius:50%;flex:none;color:var(--muted);display:grid;place-items:center}",
      ".vm-wr:hover .vm-rb{opacity:1}@media (hover:none){.vm-rb{opacity:.55}}",
      ".vm-bar{display:flex;gap:2px;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:3px 6px;margin-top:4px}",
      ".vm-bar button{font-size:1.2rem;padding:2px 4px;border-radius:50%}.vm-bar button:hover{background:var(--panel2)}",
      ".vm-chips{display:flex;gap:4px;margin-top:2px;flex-wrap:wrap}",
      ".vm-chip{background:var(--panel2);border:1px solid transparent;border-radius:999px;padding:1px 8px;font-size:.78rem}.vm-chip.on{border-color:var(--accent2)}",
      ".vm-ib{width:38px;height:44px;display:grid;place-items:center;color:var(--muted);flex:none}.vm-ib:hover{color:var(--text)}",
      ".vm-pick{border-top:1px solid var(--line);background:var(--panel)}",
      ".vm-ptabs{display:flex;gap:6px;padding:8px 12px 0}.vm-ptabs button{padding:5px 12px;border-radius:999px;font-weight:700;font-size:.85rem;color:var(--muted)}.vm-ptabs button.on{background:var(--panel2);color:var(--text)}",
      ".vm-pbody{display:flex;flex-wrap:wrap;gap:2px;max-height:200px;overflow-y:auto;padding:8px 10px 10px}",
      ".vm-em{font-size:1.5rem;width:40px;height:40px;border-radius:8px}.vm-em:hover{background:var(--panel2)}",
      ".vm-pbody.st .vm-em{font-size:2.6rem;width:72px;height:72px}",
      ".vm-gifs{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:100%}.vm-gifs img{width:100%;height:90px;object-fit:cover;border-radius:8px;cursor:pointer}",
      ".vm-gin{display:flex;gap:6px;width:100%;margin-bottom:6px}.vm-gin input{flex:1;min-width:0;background:var(--panel2);border-radius:999px;padding:8px 14px;outline:none;border:0}",
      ".vc{position:fixed;inset:0;z-index:100;background:#0b0b0d;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:40px 16px 32px}",
      ".vc-remote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000}",
      ".vc-local{position:absolute;right:16px;top:16px;width:110px;border-radius:12px;background:#222;z-index:2;transform:scaleX(-1)}",
      ".vc-top{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:8px;text-shadow:0 1px 6px #000}.vc-n{font-weight:800;font-size:1.3rem}.vc-s{color:#ccc}",
      ".vc-bar{position:relative;z-index:2;display:flex;gap:14px}.vc-bar button{padding:14px 22px;border-radius:999px;font-weight:700;background:rgba(255,255,255,.18);color:#fff}.vc-bar .go{background:#22c55e}.vc-bar .end{background:#ef4444}"
    ].join("\n");
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  }

  function buildPanel() {
    var main = document.querySelector("main"); if (!main) return false;
    var root = el("div", "vm"); ui.root = root;
    var list = el("div", "vm-list");
    var head = el("div", "vm-head"); head.appendChild(el("span", null, "Messages"));
    var x = el("button", "vm-x"); x.setAttribute("aria-label", "Close messages"); x.innerHTML = svg("x", 22); x.addEventListener("click", closePanel);
    head.appendChild(x); list.appendChild(head);
    ui.listBody = el("div", "vm-scroll"); list.appendChild(ui.listBody);
    ui.chat = el("div", "vm-chat");
    root.appendChild(list); root.appendChild(ui.chat);
    main.appendChild(root);
    buildChatShell();
    return true;
  }

  function injectNav() {
    function item(label, size, bottom) {
      var a = el("a", "nav"); a.href = "#"; a.setAttribute("data-vm", "1");
      var ico = el("span", "ico"); ico.innerHTML = svg("message", size);
      a.appendChild(ico);
      if (bottom) a.innerHTML = svg("message", 24);
      a.appendChild(el("span", null, label));
      a.appendChild(el("span", "vm-nb"));
      a.addEventListener("click", function (e) { e.preventDefault(); if (S.open) closePanel(); else openPanel(); });
      return a;
    }
    var side = $("sidenav"), bot = $("bottomnav");
    if (side && !side.querySelector("[data-vm]")) {
      var me1 = side.querySelector('[data-nav="me"]');
      side.insertBefore(item("Messages", 24, false), me1);
    }
    if (bot && !bot.querySelector("[data-vm]")) {
      var me2 = bot.querySelector('[data-nav="me"]');
      var b = item("Inbox", 24, true);
      bot.insertBefore(b, me2);
    }
  }

  /* "Message" button on other people's profiles */
  function decorateProfile() {
    var view = $("view-profile"); if (!view) return;
    var fb = view.querySelector(".pbtns .fbtn[data-uid]");
    if (!fb || fb.parentNode.querySelector(".vm-msgbtn")) return;
    var uid = fb.dataset.uid;
    var h1 = view.querySelector(".pinfo h1");
    var name = h1 ? (h1.dataset.u || h1.textContent.replace(/^@/, "")) : "user";
    var b = el("button", "btn line vm-msgbtn", "Message");
    b.addEventListener("click", function () {
      readSession();
      if (!S.me) { openLogin(); return; }
      loadFriends().then(function () {
        if (S.friends.has(uid) || isAdmin()) { openPanel(); openThread(uid, name); }
        else toast("You can message each other once you both follow each other");
      });
    });
    fb.parentNode.appendChild(b);
  }

  /* tell people when a follow turns into a friendship */
  function watchFollows() {
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".fbtn, .plus")) return;
      var before = new Set(S.friends.keys());
      setTimeout(function () {
        loadFriends().then(function () {
          S.friends.forEach(function (name, id) {
            if (!before.has(id) && before.size >= 0 && S.me) toast("You and @" + name + " are now friends. You can message them!");
          });
          if (S.open) renderList();
        });
      }, 1500);
    });
  }

  function init() {
    injectStyles(); injectStyles2();
    if (!buildPanel()) return;
    injectNav();

    // close the panel when the person navigates elsewhere
    window.addEventListener("hashchange", closePanel);
    document.addEventListener("click", function (e) {
      if (!S.open) return;
      var a = e.target.closest("#sidenav a.nav, #bottomnav a.nav, .logo, #authArea .up-btn, .umenu button");
      if (a && !a.hasAttribute("data-vm")) closePanel();
    }, true);

    // keep page shortcuts (arrow keys, space, m, l) from reaching the video feed while chatting
    document.addEventListener("keydown", function (e) {
      if (!S.open) return;
      e.stopPropagation();
      if (e.key === "Escape") { if (S.cur) closeThread(); else closePanel(); }
    }, true);

    var obs = new MutationObserver(decorateProfile);
    obs.observe($("view-profile"), { childList: true, subtree: true });
    decorateProfile();
    watchFollows();

    readSession();
    if (S.me) { loadFriends().then(refreshConvos); }
    ensureCallCh();

    setInterval(function () {
      if (document.hidden) return;
      var changed = readSession();
      ensureCallCh();
      if (changed) { if (S.open) loadAll(); else refreshConvos(); return; }
      if (!S.me) return;
      S.ticks++;
      if (S.open && S.cur) refreshThread();
      if (S.ticks % 5 === 0) refreshConvos();
    }, TICK_MS);
  }

  init();
})();
