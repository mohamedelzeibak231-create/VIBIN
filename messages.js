/* messages.js - friends-only messaging for vibin.
   Friends = two people who follow each other.
   Add this line to index.html, right before </body>:
     <script src="messages.js"></script>
*/
(function () {
  "use strict";

  var SUPABASE_URL = "https://fomasnzofymhafhomdux.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_2i35gbEiTyxxSG98TcDRjg_YeHnI3S_";
  var TICK_MS = 3000, MAX_LEN = 1000;

  var S = {
    me: null, token: null, friends: new Map(), names: new Map(), convos: [], unread: 0,
    cur: null, thread: [], sig: "", open: false, broken: false, ticks: 0
  };
  var ui = {};

  /* ---------- tiny helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var PATHS = {
    message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    back: '<path d="M15 18l-6-6 6-6"/>'
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
  var COLS = "id,sender_id,receiver_id,body,created_at,read_at";

  function loadFriends() {
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
      S.convos = Array.from(by.values()); S.unread = unread;
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
    return api(q).then(function (rows) { return (rows || []).reverse(); });
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
    c.appendChild(head);

    ui.msgs = el("div", "vm-msgs"); c.appendChild(ui.msgs);
    ui.note = el("div", "vm-note"); ui.note.style.display = "none"; c.appendChild(ui.note);

    var form = el("form", "vm-form"); form.autocomplete = "off";
    ui.input = document.createElement("input"); ui.input.type = "text"; ui.input.maxLength = MAX_LEN; ui.input.placeholder = "Message @" + name;
    ui.send = el("button"); ui.send.type = "submit"; ui.send.setAttribute("aria-label", "Send"); ui.send.innerHTML = svg("send", 20);
    form.appendChild(ui.input); form.appendChild(ui.send);
    form.addEventListener("submit", function (e) { e.preventDefault(); sendMessage(); });
    c.appendChild(form);
  }
  function updateComposer() {
    if (!S.cur || !ui.input) return;
    var ok = S.friends.has(S.cur.id);
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
      box.appendChild(el("div", "vm-b " + (m.sender_id === S.me ? "me" : "them"), m.body));
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
      var sig = rows.map(function (m) { return m.id + (m.read_at ? "r" : ""); }).join("|");
      if (first || sig !== S.sig) { S.sig = sig; S.thread = rows; renderMsgs(first); }
      var incoming = rows.some(function (m) { return m.receiver_id === S.me && !m.read_at; });
      if (incoming) markRead(cur.id).then(refreshConvos);
    }).catch(noop);
  }
  function sendMessage() {
    if (!S.cur || !S.me) return;
    var text = ui.input.value.trim(); if (!text) return;
    var pid = S.cur.id;
    if (!S.friends.has(pid)) { toast("You can only message friends"); return; }
    ui.input.value = "";
    var tmp = { id: "tmp" + Date.now(), sender_id: S.me, receiver_id: pid, body: text.slice(0, MAX_LEN), created_at: new Date().toISOString(), read_at: null, pending: true };
    S.thread.push(tmp); renderMsgs(true);
    api("messages", { method: "POST", body: { sender_id: S.me, receiver_id: pid, body: tmp.body }, prefer: "return=representation" })
      .then(function () { return refreshThread(true).then(refreshConvos); })
      .catch(function (e) {
        S.thread = S.thread.filter(function (m) { return m.id !== tmp.id; });
        if (S.cur && S.cur.id === pid) { renderMsgs(true); ui.input.value = tmp.body; }
        toast("Could not send. You can only message friends.");
        fail(e);
      });
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
    var name = h1 ? h1.textContent.replace(/^@/, "") : "user";
    var b = el("button", "btn line vm-msgbtn", "Message");
    b.addEventListener("click", function () {
      readSession();
      if (!S.me) { openLogin(); return; }
      loadFriends().then(function () {
        if (S.friends.has(uid)) { openPanel(); openThread(uid, name); }
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
    injectStyles();
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

    setInterval(function () {
      if (document.hidden) return;
      var changed = readSession();
      if (changed) { if (S.open) loadAll(); else refreshConvos(); return; }
      if (!S.me) return;
      S.ticks++;
      if (S.open && S.cur) refreshThread();
      if (S.ticks % 5 === 0) refreshConvos();
    }, TICK_MS);
  }

  init();
})();
