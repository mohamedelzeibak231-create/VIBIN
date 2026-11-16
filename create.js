/* vibin create studio: camera, 400+ effects (filters, looks, stickers, minigames), music picker */
(function () {
  "use strict";
  var W = 720, H = 1280;

  /* ---------- tiny color-matrix helpers (row-major 4x4, acts on [r g b 1]) ---------- */
  function I() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  function mul(a, b) { var o = new Array(16), i, j, k, s; for (i = 0; i < 4; i++) for (j = 0; j < 4; j++) { s = 0; for (k = 0; k < 4; k++) s += a[i*4+k] * b[k*4+j]; o[i*4+j] = s; } return o; }
  function scaleM(r, g, b) { return [r,0,0,0, 0,g,0,0, 0,0,b,0, 0,0,0,1]; }
  function addM(r, g, b) { return [1,0,0,r, 0,1,0,g, 0,0,1,b, 0,0,0,1]; }
  function brightM(v) { return scaleM(v, v, v); }
  function contrastM(c) { var t = 0.5 * (1 - c); return [c,0,0,t, 0,c,0,t, 0,0,c,t, 0,0,0,1]; }
  function satM(s) { var lr = .2126, lg = .7152, lb = .0722, a = (1-s)*lr, b = (1-s)*lg, c = (1-s)*lb; return [a+s,b,c,0, a,b+s,c,0, a,b,c+s,0, 0,0,0,1]; }
  function hueM(deg) {
    var r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [.213+c*.787-s*.213, .715-c*.715-s*.715, .072-c*.072+s*.928, 0,
            .213-c*.213+s*.143, .715+c*.285+s*.140, .072-c*.072-s*.283, 0,
            .213-c*.213-s*.787, .715-c*.715+s*.715, .072+c*.928+s*.072, 0, 0,0,0,1];
  }
  function sepiaM(a) { var m = [.393,.769,.189,0, .349,.686,.168,0, .272,.534,.131,0, 0,0,0,1], o = I(), i; for (i = 0; i < 16; i++) o[i] = I()[i] * (1 - a) + m[i] * a; return o; }
  function hex(h) { return [parseInt(h.substr(1,2),16)/255, parseInt(h.substr(3,2),16)/255, parseInt(h.substr(5,2),16)/255]; }

  /* grade = {b,c,s,h,sep,tint:[r,g,b] multiply,lift:[r,g,b] add, + optional look params (vig, grain, ...)} */
  function gradeMatrix(g) {
    var m = I();
    if (g.h) m = mul(hueM(g.h), m);
    if (g.sep) m = mul(sepiaM(g.sep), m);
    if (g.s != null) m = mul(satM(g.s), m);
    if (g.c != null) m = mul(contrastM(g.c), m);
    if (g.b != null) m = mul(brightM(g.b), m);
    if (g.tint) m = mul(scaleM(g.tint[0], g.tint[1], g.tint[2]), m);
    if (g.lift) m = mul(addM(g.lift[0], g.lift[1], g.lift[2]), m);
    return m;
  }

  /* ---------- effect registry ---------- */
  var FX = [];
  function add(e) { e.id = e.type + ":" + e.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"); FX.push(e); return e; }

  /* 1) color grades: 12 bases x 5 moods = 60, plus 14 classics */
  var BASES = [
    ["Warm", [1.08,1.0,0.88], "🌅"], ["Cool", [0.9,1.0,1.1], "🧊"], ["Rose", [1.1,0.92,1.0], "🌸"], ["Mint", [0.92,1.08,1.0], "🍃"],
    ["Gold", [1.12,1.04,0.8], "🏆"], ["Violet", [1.0,0.88,1.14], "🔮"], ["Teal", [0.85,1.05,1.08], "🌊"], ["Sunset", [1.14,0.94,0.82], "🌇"],
    ["Ice", [0.88,1.0,1.18], "❄️"], ["Forest", [0.9,1.06,0.9], "🌲"], ["Candy", [1.1,0.95,1.12], "🍬"], ["Ember", [1.18,0.9,0.78], "🔥"]
  ];
  var MOODS = [
    ["Soft", { b: 1.05, c: 0.88, s: 0.95, lift: [0.04,0.03,0.04] }],
    ["Vivid", { b: 1.02, c: 1.12, s: 1.45 }],
    ["Dark", { b: 0.82, c: 1.2, s: 1.05, vig: 0.45 }],
    ["Film", { b: 1.0, c: 1.05, s: 0.85, sep: 0.15, grain: 0.07, vig: 0.3 }],
    ["Pop", { b: 1.06, c: 1.25, s: 1.3 }]
  ];
  BASES.forEach(function (b) { MOODS.forEach(function (m) {
    var g = { b: m[1].b, c: m[1].c, s: m[1].s, sep: m[1].sep, lift: m[1].lift, tint: b[1], vig: m[1].vig, grain: m[1].grain };
    add({ type: "grade", name: b[0] + " " + m[0], icon: b[2], g: g, swatch: b[1] });
  }); });
  [
    ["Noir", "🎞️", { s: 0, c: 1.3, b: 0.95, vig: 0.5 }], ["Silver", "🪙", { s: 0, c: 1.0, b: 1.12, tint: [0.96,1,1.04] }],
    ["Sepia", "📜", { sep: 1, c: 1.05 }], ["Vintage", "📻", { sep: 0.4, c: 0.95, s: 0.8, grain: 0.09, vig: 0.4, lift: [0.03,0.02,0] }],
    ["Polaroid", "📸", { c: 1.1, s: 1.1, b: 1.05, tint: [1.05,1.0,0.92], vig: 0.25, lift: [0.02,0.02,0.04] }],
    ["Blueprint", "📐", { s: 0, tint: [0.4,0.7,1.5], c: 1.3 }], ["Radioactive", "☢️", { h: 90, s: 1.8, c: 1.15 }],
    ["Inverted", "🔁", { inv: 1 }], ["Night Vision", "🦉", { s: 0, tint: [0.3,1.6,0.3], c: 1.3, grain: 0.1, vig: 0.5 }],
    ["Golden Hour", "🌤️", { tint: [1.15,1.02,0.78], c: 1.1, s: 1.2, b: 1.05 }], ["Cyberpunk", "🌃", { tint: [1.1,0.8,1.3], c: 1.3, s: 1.5, b: 0.95 }],
    ["Matrix", "🟩", { s: 0, tint: [0.2,1.5,0.4], c: 1.4, b: 0.9 }], ["Fade", "🌫️", { c: 0.75, s: 0.7, b: 1.1, lift: [0.08,0.08,0.08] }],
    ["Bleach", "🥛", { s: 0.3, c: 1.4, b: 1.1 }]
  ].forEach(function (c) { add({ type: "grade", name: c[0], icon: c[1], g: c[2], swatch: c[2].tint || [1,1,1] }); });

  /* 2) looks (distortions & overlays) */
  function look(name, icon, p) { add({ type: "look", name: name, icon: icon, p: p }); }
  [4, 8, 14, 22].forEach(function (s, i) { look("Pixel " + ["S","M","L","XL"][i], "🟦", { pix: s }); });
  look("Mirror Left", "🪞", { mirror: 1 }); look("Mirror Right", "🪞", { mirror: 2 }); look("Mirror Top", "🪞", { mirror: 3 });
  look("Mirror Bottom", "🪞", { mirror: 4 }); look("Mirror Quad", "🔲", { mirror: 5 });
  [3, 4, 5, 6, 8, 10, 12, 16].forEach(function (k) { look("Kaleido " + k, "🔯", { kal: k }); });
  [0.004, 0.008, 0.014, 0.022].forEach(function (v, i) { look("RGB Split " + ["S","M","L","XL"][i], "🌈", { rgb: v }); });
  look("VHS", "📼", { vhs: 1, rgb: 0.006, scan: 0.5, grain: 0.1, vig: 0.3 });
  look("VHS Heavy", "📼", { vhs: 3, rgb: 0.012, scan: 0.7, grain: 0.16, glitch: 0.3 });
  look("CRT", "📺", { scan: 0.8, vig: 0.6, rgb: 0.003, grade: { s: 1.2, c: 1.15 } });
  look("Scanlines", "▤", { scan: 1 });
  [0.3, 0.6, 1.0].forEach(function (v, i) { look("Glitch " + ["S","M","L"][i], "⚡", { glitch: v, rgb: 0.006 * (i + 1) }); });
  [0.006, 0.012, 0.022].forEach(function (v, i) { look("Wave " + ["S","M","L"][i], "〰️", { wave: v }); });
  [-1.5, -3, 1.5, 3].forEach(function (v) { look("Swirl " + (v < 0 ? "Left " : "Right ") + Math.abs(v), "🌀", { swirl: v }); });
  [0.8, 1.6, -0.6, -1.2].forEach(function (v) { look((v > 0 ? "Fisheye " : "Pinch ") + Math.abs(v), v > 0 ? "🐟" : "🤏", { fish: v }); });
  [3, 5, 8].forEach(function (v) { look("Poster " + v, "🎨", { post: v }); });
  look("Neon Edges", "💡", { edge: -1 }); look("Sketch", "✏️", { edge: 1 }); look("Neon Glow", "🔆", { edge: -0.6, grade: { b: 1.1, s: 1.5 } });
  look("Thermal", "🌡️", { thermal: 1 });
  [6, 10].forEach(function (v, i) { look("Halftone " + ["S","L"][i], "⚫", { dots: v }); });
  [0.002, 0.004, 0.007].forEach(function (v, i) { look("Dreamy " + ["S","M","L"][i], "☁️", { blur: v, grade: { b: 1.08, s: 1.15 } }); });
  look("Zoom Pulse", "🔍", { zoom: 1 }); look("Heartbeat", "💓", { zoom: 2 }); look("Vignette", "⭕", { vig: 0.8 });
  look("Film Grain", "🎬", { grain: 0.18 }); look("Dirty Lens", "🫧", { blur: 0.0025, grain: 0.1, vig: 0.4 });
  look("Trippy", "🍄", { wave: 0.01, rgb: 0.01, swirl: 1, grade: { h: 40, s: 1.6 } });
  look("Earthquake", "🫨", { wave: 0.008, glitch: 0.4, zoom: 1 }); look("Underwater", "🐠", { wave: 0.007, blur: 0.0015, grade: { tint: [0.7,1.0,1.2], s: 1.2 } });
  look("Retro Game", "👾", { pix: 8, post: 4, scan: 0.4 }); look("Comic", "💥", { post: 4, edge: 0.6, dots: 7 });
  look("Dream Mirror", "🦋", { mirror: 1, blur: 0.002, grade: { b: 1.08, s: 1.3 } }); look("Disco Kaleido", "🪩", { kal: 6, rgb: 0.01, grade: { s: 1.6 } });

  /* 3) duotones */
  [
    ["Sunset Duo", "#2a0845", "#ff9a5a"], ["Ocean Duo", "#03254c", "#7fe0ff"], ["Candy Duo", "#6a0572", "#ffb3d9"], ["Mint Duo", "#0b3d2e", "#b9ffd9"],
    ["Fire Duo", "#2b0000", "#ffd23f"], ["Grape Duo", "#1a0b3b", "#c4a1ff"], ["Lemon Duo", "#3a3300", "#fffb8f"], ["Rose Duo", "#3b0a1a", "#ff8fb1"],
    ["Cyber Duo", "#0d0221", "#00f0ff"], ["Vapor Duo", "#ff4fd8", "#4fd8ff"], ["Gold Duo", "#2a1a00", "#ffd76a"], ["Slate Duo", "#101820", "#c9d6df"],
    ["Peach Duo", "#5a1e3a", "#ffd1b3"], ["Toxic Duo", "#0a1a00", "#b6ff00"], ["Berry Duo", "#2b0033", "#ff5c8a"], ["Sky Duo", "#0a2a66", "#e0f4ff"],
    ["Coffee Duo", "#1b0f08", "#e8c7a0"], ["Neon Duo", "#12002b", "#ff2bd6"], ["Forest Duo", "#06210f", "#9be58a"], ["Ice Duo", "#0b1d3a", "#d6f7ff"],
    ["Blood Duo", "#120000", "#ff3b3b"], ["Lavender Duo", "#2a1b4a", "#e4d4ff"], ["Mono Blue", "#000814", "#4ea8ff"], ["Mono Pink", "#14000a", "#ff6ab5"]
  ].forEach(function (d) { add({ type: "duo", name: d[0], icon: "◐", c1: hex(d[1]), c2: hex(d[2]), swatch: [hex(d[2])[0], hex(d[2])[1], hex(d[2])[2]], css: "linear-gradient(135deg," + d[1] + "," + d[2] + ")" }); });

  /* 4) stickers (particle layers): 15 sets x 4 motions = 60 */
  var SETS = [
    ["Hearts", ["❤️","💖","💗","💕","💘"]], ["Stars", ["⭐","🌟","💫","✨"]], ["Sparkles", ["✨","✨","⭐","💎"]], ["Fire", ["🔥","🔥","🧨","💥"]],
    ["Snow", ["❄️","❄️","⛄","❅"]], ["Confetti", ["🎉","🎊","🪅","🎈"]], ["Money", ["💵","💰","🪙","💸"]], ["Flowers", ["🌸","🌼","🌷","🌺"]],
    ["Notes", ["🎵","🎶","🎤","🎧"]], ["Bubbles", ["🫧","🫧","💧","🔵"]], ["Ghosts", ["👻","🎃","🦇","💀"]], ["Butterflies", ["🦋","🐝","🐞","🌿"]],
    ["Petals", ["🌸","🌹","🍂","🍁"]], ["Rainbows", ["🌈","☁️","🦄","🍭"]], ["Emojis", ["😂","😎","🥹","🤩","😭","🫶"]]
  ];
  var MOTIONS = [["Rain", "rain"], ["Rise", "rise"], ["Burst", "burst"], ["Drift", "drift"]];
  SETS.forEach(function (s) { MOTIONS.forEach(function (m) { add({ type: "sticker", name: s[0] + " " + m[0], icon: s[1][0], chars: s[1], motion: m[1] }); }); });

  window.__VIBIN_FX = { FX: FX, gradeMatrix: gradeMatrix, mul: mul, I: I, add: add, W: W, H: H };
})();
/* ---------- minigames: 14 engines x 16 themes = 224 ---------- */
(function () {
  "use strict";
  var R = window.__VIBIN_FX, W = R.W, H = R.H;
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var EMO = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
  function emo(c, ch, x, y, s, rot) {
    c.save(); c.translate(x, y); if (rot) c.rotate(rot);
    c.font = Math.round(s) + "px " + EMO; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(ch, 0, 0); c.restore();
  }
  function txt(c, s, x, y, size, col, stroke) {
    c.font = "800 " + size + "px system-ui,-apple-system,Segoe UI,Roboto,sans-serif"; c.textAlign = "center"; c.textBaseline = "middle";
    c.lineJoin = "round"; c.lineWidth = Math.max(4, size / 7); c.strokeStyle = stroke || "rgba(0,0,0,.65)"; c.strokeText(s, x, y);
    c.fillStyle = col || "#fff"; c.fillText(s, x, y);
  }
  function pill(c, x, y, w, h, fill) { c.fillStyle = fill; c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, h / 2); else c.rect(x, y, w, h); c.fill(); }

  var WORLDS = [
    ["Pizza", ["🍕","🍔","🍟","🌭","🌮"], ["🥦","🧅","🌶️"]], ["Sweets", ["🍩","🍪","🍦","🧁","🍫"], ["🥒","🧄","🥬"]],
    ["Fruit", ["🍎","🍓","🍌","🍇","🍑"], ["🪨","💣","🧱"]], ["Animals", ["🐶","🐱","🐼","🐸","🐰"], ["🕷️","🦂","🐍"]],
    ["Ocean", ["🐠","🐙","🐬","🦀","🐳"], ["🦈","🪼","⚓"]], ["Space", ["⭐","🌟","🪐","🚀","🛸"], ["☄️","👽","🕳️"]],
    ["Sports", ["⚽","🏀","🏈","🎾","🏐"], ["🧱","🪨","🛑"]], ["Music", ["🎵","🎶","🎸","🥁","🎤"], ["🔇","📢","💿"]],
    ["Party", ["🎉","🎈","🎁","🎂","🪩"], ["🧨","💣","🧹"]], ["Money", ["💰","💵","💎","🪙","👑"], ["💣","🧲","🧾"]],
    ["Love", ["❤️","💖","💘","🌹","💌"], ["💔","🥀","⛓️"]], ["Spooky", ["🎃","👻","🦇","🍬","🕯️"], ["🔪","🧟","🪦"]],
    ["Winter", ["⛄","❄️","🎿","🧣","☕"], ["🧊","🌨️","🥶"]], ["Summer", ["🍉","🏖️","🍦","🕶️","🌴"], ["☀️","🔥","🦂"]],
    ["Gaming", ["🎮","👾","🕹️","🏆","🪙"], ["🐛","💥","☠️"]], ["Magic", ["✨","🔮","🪄","🦄","🌈"], ["🌑","💀","🧪"]]
  ];
  var TOPICS = [
    ["Today's Vibe", ["Chill","Hyper","Main Character","Cozy","Chaotic","Sleepy","Hungry","Unstoppable"]],
    ["Snack Pick", ["Pizza","Fries","Ice cream","Sushi","Tacos","Ramen","Cookies","Burger"]],
    ["Superpower", ["Fly","Invisible","Time Stop","Mind Read","Super Speed","Teleport","Strength","Talk to Pets"]],
    ["Dare", ["Dance 10s","Sing a line","Funny face","Robot voice","5 jumps","Statue pose","Wink 3x","Tell a joke"]],
    ["Truth", ["Last text?","Biggest fear?","Fav song rn?","Hidden talent?","Weirdest habit?","Dream job?","Last laugh?","Fav app?"]],
    ["Aura Color", ["Red","Orange","Gold","Green","Blue","Purple","Pink","White"]],
    ["Movie Night", ["Comedy","Horror","Anime","Action","Romance","Sci-fi","Thriller","Cartoon"]],
    ["Yes or No", ["Yes","No","Maybe","Definitely","Never","Ask later","100%","Nah"]],
    ["Rizz Level", ["12%","34%","50%","67%","80%","99%","100%","Infinite"]],
    ["Main Character", ["Hero","Villain","Sidekick","Mentor","Rival","Trickster","Mystery NPC","Final Boss"]],
    ["Pet Match", ["Dog","Cat","Hamster","Parrot","Fish","Bunny","Turtle","Dragon"]],
    ["Dream Trip", ["Tokyo","Paris","New York","Bali","Dubai","Rome","Iceland","Rio"]],
    ["Your Era", ["Y2K","90s","80s","Medieval","Space Age","Pirate","Wild West","Future"]],
    ["Mood Song", ["Hype","Sad boi","Love","Chill","Party","Gym","Road trip","Sleepy"]],
    ["Lucky Number", ["6","7","13","21","42","67","77","99"]],
    ["Next Move", ["Nap","Snack","Scroll","Dance","Text them","Go outside","Clean","Create"]]
  ];
  var COLORS = ["#ff4d6d","#ffb703","#06d6a0","#4cc9f0","#b388ff","#ff9e00","#f72585","#80ed99"];

  /* each engine: make(opts) -> {update(dt), draw(c), down(x,y), move(x,y), up(), over, score, hud, self (handles own start)} */
  var E = {};

  E.catch = function (o) {
    var g = { score: 0, lives: 3, t: 40, x: W / 2, items: [], sp: 0, hud: "" };
    g.update = function (dt) {
      g.t -= dt; g.sp -= dt;
      if (g.sp <= 0) { g.sp = Math.max(.32, .8 - g.score * .01); var bad = Math.random() < .25; g.items.push({ x: rnd(60, W - 60), y: -40, v: rnd(380, 560) + g.score * 4, bad: bad, ch: bad ? pick(o.bad) : pick(o.good), r: rnd(-.4, .4) }); }
      g.items.forEach(function (i) { i.y += i.v * dt; });
      g.items = g.items.filter(function (i) {
        if (i.y > H - 380 && i.y < H - 280 && Math.abs(i.x - g.x) < 90) { if (i.bad) g.lives--; else g.score++; return false; }
        return i.y < H + 60;
      });
      g.hud = "⏱ " + Math.ceil(g.t) + "   " + "❤️".repeat(Math.max(0, g.lives)) + "   ★ " + g.score;
      if (g.lives <= 0 || g.t <= 0) g.over = true;
    };
    g.draw = function (c) { g.items.forEach(function (i) { emo(c, i.ch, i.x, i.y, 84, i.r); }); emo(c, "🧺", g.x, H - 330, 130); };
    g.down = g.move = function (x) { g.x = Math.max(70, Math.min(W - 70, x)); };
    return g;
  };

  E.pop = function (o) {
    var g = { score: 0, t: 30, ts: [], sp: 0, hud: "" };
    g.update = function (dt) {
      g.t -= dt; g.sp -= dt;
      if (g.sp <= 0) { g.sp = Math.max(.35, .75 - g.score * .008); var bad = Math.random() < .2; g.ts.push({ x: rnd(100, W - 100), y: rnd(260, H - 340), a: 0, life: rnd(1.3, 1.9), bad: bad, ch: bad ? pick(o.bad) : pick(o.good) }); }
      g.ts.forEach(function (t) { t.a += dt; });
      g.ts = g.ts.filter(function (t) { return t.a < t.life && !t.hit; });
      g.hud = "⏱ " + Math.ceil(g.t) + "   ★ " + g.score;
      if (g.t <= 0) g.over = true;
    };
    g.draw = function (c) { g.ts.forEach(function (t) { var k = Math.sin(Math.PI * t.a / t.life); emo(c, t.ch, t.x, t.y, 40 + 120 * k); }); };
    g.down = function (x, y) {
      for (var i = g.ts.length - 1; i >= 0; i--) { var t = g.ts[i], k = Math.sin(Math.PI * t.a / t.life), r = (40 + 120 * k) / 2 + 14; if (Math.hypot(x - t.x, y - t.y) < r) { t.hit = true; g.score += t.bad ? -2 : 1; if (g.score < 0) g.score = 0; return; } }
    };
    return g;
  };

  E.dodge = function (o) {
    var g = { score: 0, x: W / 2, y: H - 400, hz: [], sp: 0, hud: "", tt: 0 };
    g.update = function (dt) {
      g.tt += dt; g.sp -= dt; g.score = Math.floor(g.tt * 10);
      if (g.sp <= 0) { g.sp = Math.max(.22, .6 - g.tt * .01); g.hz.push({ x: rnd(50, W - 50), y: -40, v: rnd(420, 640) + g.tt * 8, ch: pick(o.bad.concat(o.good)), r: 0 }); }
      g.hz.forEach(function (h) { h.y += h.v * dt; h.r += dt * 3; });
      g.hz = g.hz.filter(function (h) { if (Math.hypot(h.x - g.x, h.y - g.y) < 62) g.over = true; return h.y < H + 60; });
      g.hud = "★ " + g.score;
    };
    g.draw = function (c) { g.hz.forEach(function (h) { emo(c, h.ch, h.x, h.y, 80, h.r); }); emo(c, "🏃", g.x, g.y, 110); };
    g.down = g.move = function (x, y) { g.x = Math.max(50, Math.min(W - 50, x)); g.y = Math.max(300, Math.min(H - 340, y)); };
    return g;
  };

  E.flappy = function (o) {
    var g = { score: 0, y: H / 2, v: 0, pipes: [], sp: 1, hud: "", ch: o.good[0] };
    g.update = function (dt) {
      g.v += 1700 * dt; g.y += g.v * dt; g.sp -= dt;
      if (g.sp <= 0) { g.sp = 1.5; g.pipes.push({ x: W + 60, gy: rnd(380, H - 520), pass: false }); }
      g.pipes.forEach(function (p) {
        p.x -= 300 * dt;
        if (!p.pass && p.x < 150) { p.pass = true; g.score++; }
        if (Math.abs(p.x - 150) < 76 && (g.y < p.gy - 130 || g.y > p.gy + 130)) g.over = true;
      });
      g.pipes = g.pipes.filter(function (p) { return p.x > -100; });
      if (g.y > H - 300 || g.y < 40) g.over = true;
      g.hud = "★ " + g.score;
    };
    g.draw = function (c) {
      g.pipes.forEach(function (p) {
        c.fillStyle = "rgba(60,220,140,.9)"; c.fillRect(p.x - 52, 0, 104, p.gy - 130); c.fillRect(p.x - 52, p.gy + 130, 104, H);
        c.fillStyle = "rgba(20,140,80,.95)"; c.fillRect(p.x - 62, p.gy - 170, 124, 40); c.fillRect(p.x - 62, p.gy + 130, 124, 40);
      });
      emo(c, g.ch, 150, g.y, 92, Math.max(-.5, Math.min(.8, g.v / 1400)));
    };
    g.down = function () { g.v = -620; };
    return g;
  };

  E.whack = function (o) {
    var g = { score: 0, t: 30, holes: [], sp: .4, hud: "" }, i;
    for (i = 0; i < 9; i++) g.holes.push({ x: W / 2 + ((i % 3) - 1) * 220, y: 520 + Math.floor(i / 3) * 210, up: 0, ch: "", bad: false });
    g.update = function (dt) {
      g.t -= dt; g.sp -= dt;
      if (g.sp <= 0) { g.sp = rnd(.35, .75); var h = pick(g.holes); if (h.up <= 0) { h.up = rnd(.8, 1.2); h.bad = Math.random() < .22; h.ch = h.bad ? pick(o.bad) : pick(o.good); } }
      g.holes.forEach(function (h) { h.up -= dt; });
      g.hud = "⏱ " + Math.ceil(g.t) + "   ★ " + g.score;
      if (g.t <= 0) g.over = true;
    };
    g.draw = function (c) {
      g.holes.forEach(function (h) {
        c.fillStyle = "rgba(20,12,8,.8)"; c.beginPath(); c.ellipse(h.x, h.y + 40, 86, 30, 0, 0, 7); c.fill();
        if (h.up > 0) emo(c, h.ch, h.x, h.y - 6, 120);
        c.fillStyle = "rgba(90,55,30,.95)"; c.beginPath(); c.ellipse(h.x, h.y + 52, 90, 26, 0, 0, Math.PI); c.fill();
      });
    };
    g.down = function (x, y) { g.holes.forEach(function (h) { if (h.up > 0 && Math.hypot(x - h.x, y - h.y) < 90) { h.up = 0; g.score += h.bad ? -1 : 1; if (g.score < 0) g.score = 0; } }); };
    return g;
  };

  E.wheel = function (o) {
    var g = { self: true, ang: 0, v: 0, res: "", hud: "", n: o.opts.length };
    g.update = function (dt) {
      if (g.v > 0) {
        g.ang += g.v * dt; g.v *= Math.pow(.45, dt);
        if (g.v < .05) { g.v = 0; var seg = Math.PI * 2 / g.n, a = ((-Math.PI / 2 - g.ang) % (Math.PI * 2) + Math.PI * 4) % (Math.PI * 2); g.res = o.opts[Math.floor(a / seg) % g.n]; }
      }
      g.hud = g.v > 0 ? "spinning..." : (g.res ? "" : "tap to spin");
    };
    g.draw = function (c) {
      var cx = W / 2, cy = 640, r = 290, seg = Math.PI * 2 / g.n, i;
      for (i = 0; i < g.n; i++) {
        c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, r, g.ang + i * seg, g.ang + (i + 1) * seg); c.closePath();
        c.fillStyle = COLORS[i % COLORS.length]; c.globalAlpha = .92; c.fill(); c.globalAlpha = 1; c.strokeStyle = "#fff"; c.lineWidth = 4; c.stroke();
        c.save(); c.translate(cx, cy); c.rotate(g.ang + (i + .5) * seg); txt(c, o.opts[i], r * .6, 0, 30); c.restore();
      }
      c.fillStyle = "#fff"; c.beginPath(); c.arc(cx, cy, 34, 0, 7); c.fill();
      c.beginPath(); c.moveTo(cx - 24, cy - r - 24); c.lineTo(cx + 24, cy - r - 24); c.lineTo(cx, cy - r + 26); c.closePath(); c.fillStyle = "#fff"; c.strokeStyle = "#000"; c.lineWidth = 4; c.fill(); c.stroke();
      if (g.res && !g.v) { pill(c, W / 2 - 250, 930, 500, 110, "rgba(0,0,0,.65)"); txt(c, g.res, W / 2, 985, 56, "#ffe066"); }
    };
    g.down = function () { if (!g.v) { g.res = ""; g.v = rnd(14, 24); } };
    return g;
  };

  E.slots = function (o) {
    var g = { self: true, reels: [0, 1, 2], spin: [0, 0, 0], tt: 0, msg: "", hud: "", ch: o.good.concat(o.bad) };
    g.update = function (dt) {
      var any = false;
      for (var i = 0; i < 3; i++) if (g.spin[i] > 0) { g.spin[i] -= dt; any = true; if (g.spin[i] <= 0) g.reels[i] = Math.floor(Math.random() * g.ch.length); else if (Math.random() < .5) g.reels[i] = Math.floor(Math.random() * g.ch.length); }
      if (g.fin && !any) { g.fin = false; var a = g.reels; g.msg = (a[0] === a[1] && a[1] === a[2]) ? "JACKPOT!!" : (a[0] === a[1] || a[1] === a[2] || a[0] === a[2]) ? "So close!" : "Try again"; }
      g.hud = any ? "" : (g.msg || "tap to spin");
    };
    g.draw = function (c) {
      for (var i = 0; i < 3; i++) { var x = W / 2 + (i - 1) * 210; pill(c, x - 90, 470, 180, 260, "rgba(0,0,0,.55)"); c.strokeStyle = "#ffe066"; c.lineWidth = 6; c.strokeRect(x - 90, 470, 180, 260); emo(c, g.ch[g.reels[i]], x, 600, 130); }
      if (g.msg && !g.fin) txt(c, g.msg, W / 2, 830, 74, g.msg === "JACKPOT!!" ? "#ffe066" : "#fff");
    };
    g.down = function () { if (g.spin.some(function (s) { return s > 0; })) return; g.msg = ""; g.fin = true; g.spin = [.9, 1.4, 1.9]; };
    return g;
  };

  E.reaction = function (o) {
    var g = { self: true, st: "idle", t: 0, wait: 0, best: 0, ms: 0, hud: "", ch: o.good[0] };
    g.update = function (dt) {
      if (g.st === "wait") { g.t += dt; if (g.t >= g.wait) { g.st = "go"; g.t = 0; } }
      else if (g.st === "go") g.t += dt;
      g.hud = g.st === "idle" ? "tap to start" : g.st === "wait" ? "wait for it..." : g.st === "go" ? "TAP!" : (g.msg || "");
    };
    g.draw = function (c) {
      var col = g.st === "go" ? "rgba(40,220,110,.85)" : g.st === "wait" ? "rgba(235,70,70,.8)" : "rgba(60,60,80,.7)";
      c.fillStyle = col; c.beginPath(); c.arc(W / 2, 640, 260, 0, 7); c.fill(); emo(c, g.ch, W / 2, 640, 220);
      if (g.st === "done") txt(c, g.ms + " ms", W / 2, 940, 84, "#ffe066");
      if (g.st === "early") txt(c, "Too soon 😬", W / 2, 940, 70, "#ff8a8a");
    };
    g.down = function () {
      if (g.st === "idle" || g.st === "done" || g.st === "early") { g.st = "wait"; g.t = 0; g.wait = rnd(1.4, 3.8); g.msg = ""; }
      else if (g.st === "wait") { g.st = "early"; g.msg = "too soon!"; }
      else if (g.st === "go") { g.ms = Math.round(g.t * 1000); g.st = "done"; g.msg = g.ms + " ms"; }
    };
    return g;
  };

  E.stack = function (o) {
    var g = { score: 0, blocks: [{ x: W / 2, w: 300 }], cur: { x: 100, w: 300, d: 1 }, sp: 380, hud: "", cam: 0 };
    g.update = function (dt) {
      g.cur.x += g.cur.d * g.sp * dt; if (g.cur.x > W - g.cur.w / 2) g.cur.d = -1; if (g.cur.x < g.cur.w / 2) g.cur.d = 1;
      var tgt = Math.max(0, (g.blocks.length - 6) * 64); g.cam += (tgt - g.cam) * Math.min(1, dt * 5);
      g.hud = "★ " + g.score;
    };
    g.draw = function (c) {
      var by = function (i) { return H - 330 - i * 64 + g.cam; };
      g.blocks.forEach(function (b, i) { c.fillStyle = "hsl(" + (i * 32 % 360) + ",80%,60%)"; c.fillRect(b.x - b.w / 2, by(i), b.w, 60); });
      var n = g.blocks.length; c.fillStyle = "hsl(" + (n * 32 % 360) + ",85%,66%)"; c.fillRect(g.cur.x - g.cur.w / 2, by(n), g.cur.w, 60);
      emo(c, o.good[0], g.cur.x, by(n) - 40, 70);
    };
    g.down = function () {
      var p = g.blocks[g.blocks.length - 1], l = Math.max(p.x - p.w / 2, g.cur.x - g.cur.w / 2), r = Math.min(p.x + p.w / 2, g.cur.x + g.cur.w / 2);
      if (r - l <= 6) { g.over = true; return; }
      g.blocks.push({ x: (l + r) / 2, w: r - l }); g.score++; g.cur = { x: g.cur.d > 0 ? 80 : W - 80, w: r - l, d: g.cur.d }; g.sp = Math.min(760, g.sp + 18);
    };
    return g;
  };

  E.tapfast = function (o) {
    var g = { score: 0, t: 10, pulse: 0, hud: "", fx: [] };
    g.update = function (dt) { g.t -= dt; g.pulse = Math.max(0, g.pulse - dt * 6); g.fx.forEach(function (f) { f.y -= 260 * dt; f.a -= dt * 1.5; }); g.fx = g.fx.filter(function (f) { return f.a > 0; }); g.hud = "⏱ " + Math.max(0, g.t).toFixed(1) + "   ★ " + g.score; if (g.t <= 0) g.over = true; };
    g.draw = function (c) { emo(c, o.good[0], W / 2, 650, 220 + g.pulse * 70); g.fx.forEach(function (f) { c.globalAlpha = Math.max(0, f.a); emo(c, pick(o.good), f.x, f.y, 56); c.globalAlpha = 1; }); };
    g.down = function (x, y) { g.score++; g.pulse = 1; if (g.fx.length < 30) g.fx.push({ x: x, y: y, a: 1 }); };
    return g;
  };

  E.rhythm = function (o) {
    var g = { score: 0, miss: 0, t: 30, notes: [], sp: 0, hud: "", hit: H - 380, fl: [0, 0, 0, 0] };
    g.update = function (dt) {
      g.t -= dt; g.sp -= dt;
      if (g.sp <= 0) { g.sp = rnd(.38, .6); g.notes.push({ l: Math.floor(Math.random() * 4), y: -50, ch: pick(o.good) }); }
      g.notes.forEach(function (n) { n.y += 620 * dt; });
      g.notes = g.notes.filter(function (n) { if (n.y > g.hit + 120) { g.miss++; return false; } return !n.done; });
      g.fl = g.fl.map(function (v) { return Math.max(0, v - dt * 4); });
      g.hud = "⏱ " + Math.ceil(g.t) + "   ★ " + g.score + "   ✖ " + g.miss;
      if (g.t <= 0 || g.miss >= 10) g.over = true;
    };
    g.draw = function (c) {
      var lw = W / 4, i;
      for (i = 0; i < 4; i++) { c.fillStyle = "rgba(255,255,255," + (.06 + g.fl[i] * .3) + ")"; c.fillRect(i * lw + 4, 180, lw - 8, H - 180); c.fillStyle = COLORS[i]; c.fillRect(i * lw + 8, g.hit - 6, lw - 16, 12); }
      g.notes.forEach(function (n) { emo(c, n.ch, n.l * lw + lw / 2, n.y, 92); });
    };
    g.down = function (x) {
      var l = Math.max(0, Math.min(3, Math.floor(x / (W / 4)))); g.fl[l] = 1;
      var best = null; g.notes.forEach(function (n) { if (n.l === l && Math.abs(n.y - g.hit) < 110 && (!best || Math.abs(n.y - g.hit) < Math.abs(best.y - g.hit))) best = n; });
      if (best) { best.done = true; g.score++; } else g.miss += .5;
    };
    return g;
  };

  E.runner = function (o) {
    var g = { score: 0, y: 0, v: 0, obs: [], sp: 1, hud: "", tt: 0, gy: H - 400, ch: o.good[0] };
    g.update = function (dt) {
      g.tt += dt; g.score = Math.floor(g.tt * 10); g.v += 2600 * dt; g.y += g.v * dt; if (g.y > 0) { g.y = 0; g.v = 0; }
      g.sp -= dt; if (g.sp <= 0) { g.sp = rnd(.9, 1.6) - Math.min(.4, g.tt * .008); g.obs.push({ x: W + 60, ch: pick(o.bad) }); }
      var s = 460 + g.tt * 9; g.obs.forEach(function (ob) { ob.x -= s * dt; if (Math.abs(ob.x - 170) < 60 && g.y > -70) g.over = true; });
      g.obs = g.obs.filter(function (ob) { return ob.x > -80; });
      g.hud = "★ " + g.score;
    };
    g.draw = function (c) { c.fillStyle = "rgba(255,255,255,.75)"; c.fillRect(0, g.gy + 50, W, 8); g.obs.forEach(function (ob) { emo(c, ob.ch, ob.x, g.gy, 90); }); emo(c, g.ch, 170, g.gy + g.y, 110); };
    g.down = function () { if (g.y >= -2) g.v = -1050; };
    return g;
  };

  E.memory = function (o) {
    var g = { score: 0, seq: [], i: 0, show: 0, phase: "show", lit: -1, tm: 0, hud: "", fl: -1, flt: 0 };
    function next() { g.seq.push(Math.floor(Math.random() * 4)); g.show = 0; g.phase = "show"; g.tm = .6; g.i = 0; }
    next();
    function pos(i) { return { x: W / 2 + (i % 2 ? 170 : -170), y: 560 + (i > 1 ? 340 : 0) }; }
    g.update = function (dt) {
      g.flt -= dt;
      if (g.phase === "show") { g.tm -= dt; if (g.tm <= 0) { if (g.lit >= 0) { g.lit = -1; g.tm = .25; g.show++; } else if (g.show < g.seq.length) { g.lit = g.seq[g.show]; g.tm = .55; } else { g.phase = "play"; g.i = 0; } } }
      g.hud = g.phase === "show" ? "watch..." : "your turn!  ★ " + g.score;
    };
    g.draw = function (c) {
      for (var i = 0; i < 4; i++) { var p = pos(i), on = g.lit === i || (g.flt > 0 && g.fl === i); c.fillStyle = COLORS[i]; c.globalAlpha = on ? 1 : .45; c.beginPath(); c.arc(p.x, p.y, 150, 0, 7); c.fill(); c.globalAlpha = 1; emo(c, o.good[i], p.x, p.y, on ? 150 : 110); }
    };
    g.down = function (x, y) {
      if (g.phase !== "play") return;
      for (var i = 0; i < 4; i++) { var p = pos(i); if (Math.hypot(x - p.x, y - p.y) < 150) {
        g.fl = i; g.flt = .25;
        if (g.seq[g.i] !== i) { g.over = true; return; }
        g.i++; if (g.i >= g.seq.length) { g.score++; next(); } return;
      } }
    };
    return g;
  };

  E.picker = function (o) {
    var g = { self: true, run: false, t: 0, idx: 0, res: "", hud: "" };
    g.update = function (dt) { if (g.run) { g.t += dt; g.idx = Math.floor(g.t * 14) % o.opts.length; if (g.t > g.dur) { g.run = false; g.res = o.opts[g.idx]; } } g.hud = g.run ? "" : (g.res ? "" : "tap to shuffle"); };
    g.draw = function (c) {
      pill(c, 60, 480, W - 120, 280, "rgba(0,0,0,.6)"); c.strokeStyle = "#fff"; c.lineWidth = 5; c.strokeRect(60, 480, W - 120, 280);
      txt(c, g.run ? o.opts[g.idx] : (g.res || "?"), W / 2, 620, 76, g.run ? "#fff" : "#ffe066");
      if (g.res && !g.run) { emo(c, "🎉", 120, 460, 80); emo(c, "🎉", W - 120, 460, 80, .4); txt(c, "tap to shuffle again", W / 2, 840, 34, "#fff"); }
    };
    g.down = function () { if (!g.run) { g.res = ""; g.run = true; g.t = 0; g.dur = rnd(1.8, 3.2); } };
    return g;
  };

  /* wrapper that handles ready/over screens */
  function Runner(engine, opts, name) {
    this.engine = engine; this.opts = opts; this.name = name; this.reset();
  }
  Runner.prototype.reset = function () { this.g = E[this.engine](this.opts); this.state = this.g.self ? "play" : "ready"; this.best = this.best || 0; this.last = 0; };
  Runner.prototype.update = function (dt) {
    if (this.state !== "play") return;
    this.g.update(Math.min(dt, .05));
    if (this.g.over) { this.state = "over"; this.last = this.g.score || 0; if (this.last > this.best) this.best = this.last; }
  };
  Runner.prototype.draw = function (c) {
    var g = this.g;
    if (this.state === "ready") { pill(c, 70, 560, W - 140, 150, "rgba(0,0,0,.6)"); txt(c, this.name, W / 2, 610, 42); txt(c, "tap to play", W / 2, 668, 34, "#ffe066"); return; }
    g.draw(c);
    if (g.hud) { pill(c, W / 2 - 230, 150, 460, 66, "rgba(0,0,0,.55)"); txt(c, g.hud, W / 2, 184, 34); }
    if (this.state === "over") {
      pill(c, 70, 480, W - 140, 270, "rgba(0,0,0,.72)"); txt(c, "Score " + this.last, W / 2, 560, 80, "#ffe066");
      txt(c, "best " + this.best, W / 2, 636, 34); txt(c, "tap to retry", W / 2, 700, 36);
    }
  };
  Runner.prototype.down = function (x, y) {
    if (this.state === "ready") { this.state = "play"; return; }
    if (this.state === "over") { var b = this.best; this.reset(); this.best = b; this.state = this.g.self ? "play" : "play"; return; }
    if (this.g.down) this.g.down(x, y);
  };
  Runner.prototype.move = function (x, y) { if (this.state === "play" && this.g.move) this.g.move(x, y); };

  /* register 224 games */
  var ENG = [
    ["catch", "Catch", "🧺", false], ["pop", "Pop", "👆", false], ["dodge", "Dodge", "🏃", false], ["flappy", "Flap", "🐦", false],
    ["whack", "Whack", "🔨", false], ["slots", "Slots", "🎰", false], ["reaction", "Reflex", "⚡", false], ["stack", "Stack", "🧱", false],
    ["tapfast", "Tap Rush", "💨", false], ["rhythm", "Rhythm", "🥁", false], ["runner", "Run", "🏃‍♂️", false], ["memory", "Memory", "🧠", false],
    ["wheel", "Wheel", "🎡", true], ["picker", "Shuffle", "🔀", true]
  ];
  ENG.forEach(function (e) {
    var list = e[3] ? TOPICS : WORLDS;
    list.forEach(function (w) {
      var opts = e[3] ? { opts: w[1] } : { good: w[1], bad: w[2] };
      var name = w[0] + " " + e[1];
      R.add({ type: "game", name: name, icon: e[3] ? e[2] : w[1][0], engine: e[0], engineLabel: e[1], opts: opts, make: function () { return new Runner(e[0], opts, name); } });
    });
  });
  R.ENGINES = ENG.map(function (e) { return { key: e[0], label: e[1], icon: e[2] }; });
  R.emo = emo; R.txt = txt; R.pick = pick; R.rnd = rnd;
})();
/* ---------- renderer: webgl shader for filters/looks, 2d composite for stickers & games ---------- */
(function () {
  "use strict";
  var R = window.__VIBIN_FX, W = R.W, H = R.H;

  var VS = "attribute vec2 p;varying vec2 v_uv;void main(){v_uv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}";
  var FS = [
    "#ifdef GL_FRAGMENT_PRECISION_HIGH", "precision highp float;", "#else", "precision mediump float;", "#endif",
    "varying vec2 v_uv;uniform sampler2D u_tex;uniform vec2 u_res;uniform vec2 u_scale;uniform float u_flip;uniform float u_time;",
    "uniform mat4 u_mat;uniform float u_inv;",
    "uniform float u_pix,u_mirror,u_kal,u_rgb,u_scan,u_vig,u_grain,u_wave,u_swirl,u_post,u_edge,u_blur,u_glitch,u_dots,u_fish,u_zoom,u_thermal,u_vhs,u_duo;",
    "uniform vec3 u_c1,u_c2;",
    "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "vec2 cam(vec2 uv){vec2 c=(uv-0.5)*u_scale+0.5;if(u_flip>0.5)c.x=1.0-c.x;return c;}",
    "vec3 tex(vec2 uv){return texture2D(u_tex,cam(uv)).rgb;}",
    "float lum(vec3 c){return dot(c,vec3(0.2126,0.7152,0.0722));}",
    "void main(){",
    " vec2 uv=v_uv;",
    " if(u_zoom>0.5){float z=1.0+0.07*u_zoom*(0.5+0.5*sin(u_time*(u_zoom>1.5?9.0:5.0)));uv=(uv-0.5)/z+0.5;}",
    " if(u_mirror>0.5){",
    "  if(u_mirror<1.5){if(uv.x>0.5)uv.x=1.0-uv.x;}",
    "  else if(u_mirror<2.5){if(uv.x<0.5)uv.x=1.0-uv.x;}",
    "  else if(u_mirror<3.5){if(uv.y<0.5)uv.y=1.0-uv.y;}",
    "  else if(u_mirror<4.5){if(uv.y>0.5)uv.y=1.0-uv.y;}",
    "  else{uv=abs(mod(uv*2.0,2.0)-1.0);}",
    " }",
    " if(abs(u_swirl)>0.001){vec2 d=uv-0.5;float r=length(d);float a=u_swirl*(1.0-smoothstep(0.0,0.62,r));float s=sin(a),c=cos(a);d=vec2(c*d.x-s*d.y,s*d.x+c*d.y);uv=0.5+d;}",
    " if(abs(u_fish)>0.001){vec2 d=uv-0.5;d.x*=u_res.x/u_res.y;float r2=dot(d,d);d*=1.0+u_fish*r2*1.6;d.x/=u_res.x/u_res.y;uv=0.5+d;}",
    " if(u_kal>0.5){vec2 p=uv-0.5;p.x*=u_res.x/u_res.y;float an=atan(p.y,p.x),r=length(p),sg=6.2831853/u_kal;an=abs(mod(an,sg)-sg*0.5);p=r*vec2(cos(an),sin(an));p.x/=u_res.x/u_res.y;uv=p+0.5;}",
    " if(u_wave>0.0001){uv.x+=sin(uv.y*14.0+u_time*4.0)*u_wave;uv.y+=cos(uv.x*11.0+u_time*3.0)*u_wave*0.7;}",
    " if(u_pix>0.5){vec2 g=u_res/u_pix;uv=(floor(uv*g)+0.5)/g;}",
    " if(u_glitch>0.001){float b=floor(uv.y*16.0);float n=hash(vec2(b,floor(u_time*9.0)));if(n>1.0-u_glitch*0.35){uv.x+=(hash(vec2(b,u_time))-0.5)*0.22*u_glitch;}}",
    " if(u_vhs>0.001){uv.x+=(hash(vec2(floor(uv.y*260.0),floor(u_time*24.0)))-0.5)*0.012*u_vhs;uv.y+=0.0015*sin(u_time*3.0);}",
    " uv=clamp(uv,0.001,0.999);",
    " vec3 col;",
    " if(u_rgb>0.0001){col=vec3(tex(uv+vec2(u_rgb,0.0)).r,tex(uv).g,tex(uv-vec2(u_rgb,0.0)).b);}else{col=tex(uv);}",
    " if(u_blur>0.0001){vec3 s=col;for(int i=0;i<8;i++){float a=float(i)*0.7853982;s+=tex(uv+vec2(cos(a),sin(a))*u_blur*vec2(1.0,u_res.x/u_res.y));}col=s/9.0;}",
    " if(abs(u_edge)>0.001){vec2 px=vec2(1.5)/u_res;float tl=lum(tex(uv+vec2(-px.x,px.y))),t=lum(tex(uv+vec2(0.0,px.y))),tr=lum(tex(uv+px)),l=lum(tex(uv+vec2(-px.x,0.0))),r=lum(tex(uv+vec2(px.x,0.0))),bl=lum(tex(uv-px)),b=lum(tex(uv-vec2(0.0,px.y))),br=lum(tex(uv+vec2(px.x,-px.y)));",
    "  float gx=-tl-2.0*l-bl+tr+2.0*r+br,gy=-tl-2.0*t-tr+bl+2.0*b+br;float e=sqrt(gx*gx+gy*gy);",
    "  if(u_edge>0.0){col=mix(col,vec3(1.0-clamp(e*3.0,0.0,1.0)),u_edge);}else{col=mix(col*0.35,vec3(0.15,1.0,0.9)*clamp(e*4.0,0.0,1.0)+col*0.2,-u_edge);}}",
    " if(u_thermal>0.5){float l=lum(col);vec3 t=mix(vec3(0.0,0.0,0.25),vec3(0.6,0.0,0.7),smoothstep(0.0,0.3,l));t=mix(t,vec3(1.0,0.2,0.0),smoothstep(0.3,0.55,l));t=mix(t,vec3(1.0,0.9,0.1),smoothstep(0.55,0.8,l));col=mix(t,vec3(1.0),smoothstep(0.85,1.0,l));}",
    " col=(u_mat*vec4(col,1.0)).rgb;",
    " if(u_inv>0.5)col=1.0-col;",
    " if(u_duo>0.5){col=mix(col,mix(u_c1,u_c2,clamp(lum(col),0.0,1.0)),u_duo);}",
    " if(u_post>0.5)col=floor(col*u_post+0.5)/u_post;",
    " if(u_dots>0.5){vec2 f=fract(uv*u_res/u_dots)-0.5;float m=smoothstep(sqrt(lum(col))*0.62,sqrt(lum(col))*0.62-0.12,length(f));col=mix(vec3(0.04),col*1.15,m);}",
    " if(u_scan>0.001)col*=1.0-u_scan*0.45*(0.5+0.5*sin(v_uv.y*u_res.y*3.14159));",
    " if(u_vig>0.001)col*=1.0-u_vig*smoothstep(0.3,0.95,length((v_uv-0.5)*vec2(1.0,1.15))*1.45);",
    " if(u_grain>0.001)col+=(hash(v_uv*u_res+fract(u_time)*100.0)-0.5)*u_grain;",
    " gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);",
    "}"
  ].join("\n");

  var UN = ["u_tex","u_res","u_scale","u_flip","u_time","u_mat","u_inv","u_pix","u_mirror","u_kal","u_rgb","u_scan","u_vig","u_grain","u_wave","u_swirl","u_post","u_edge","u_blur","u_glitch","u_dots","u_fish","u_zoom","u_thermal","u_vhs","u_duo","u_c1","u_c2"];
  var PKEYS = ["pix","mirror","kal","rgb","scan","vig","grain","wave","swirl","post","edge","blur","glitch","dots","fish","zoom","thermal","vhs"];

  function Renderer() {
    this.gl = null; this.ok = false;
    this.glc = document.createElement("canvas"); this.glc.width = W; this.glc.height = H;
    var gl = this.glc.getContext("webgl", { premultipliedAlpha: false, preserveDrawingBuffer: false, antialias: false }) || this.glc.getContext("experimental-webgl");
    if (!gl) return;
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) { console.warn("shader", gl.getShaderInfoLog(o)); return null; } return o; }
    var v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS); if (!v || !f) return;
    var pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; var self = this; UN.forEach(function (n) { self.u[n] = gl.getUniformLocation(pr, n); });
    this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.viewport(0, 0, W, H); this.gl = gl; this.ok = true;
  }
  /* src: video or canvas; sw/sh: its pixel size; flip: mirror selfie */
  Renderer.prototype.draw = function (src, sw, sh, flip, t, fx) {
    var gl = this.gl, u = this.u; if (!this.ok || !sw || !sh) return false;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, src); } catch (e) { return false; }
    var ar = W / H, sa = sw / sh, sx = 1, sy = 1;
    if (sa > ar) sx = ar / sa; else sy = sa / ar;
    gl.uniform1i(u.u_tex, 0); gl.uniform2f(u.u_res, W, H); gl.uniform2f(u.u_scale, sx, sy); gl.uniform1f(u.u_flip, flip ? 1 : 0); gl.uniform1f(u.u_time, t);
    var m = fx.mat, cm = [m[0],m[4],m[8],m[12], m[1],m[5],m[9],m[13], m[2],m[6],m[10],m[14], m[3],m[7],m[11],m[15]];
    gl.uniformMatrix4fv(u.u_mat, false, new Float32Array(cm)); gl.uniform1f(u.u_inv, fx.inv ? 1 : 0);
    PKEYS.forEach(function (k) { gl.uniform1f(u["u_" + k], fx.p[k] || 0); });
    gl.uniform1f(u.u_duo, fx.duo ? 1 : 0); gl.uniform3fv(u.u_c1, fx.duo ? fx.duo.c1 : [0,0,0]); gl.uniform3fv(u.u_c2, fx.duo ? fx.duo.c2 : [1,1,1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  };

  var MAXKEYS = ["rgb","scan","vig","grain","wave","blur","glitch","vhs"];
  /* merge selected effects into one render state */
  function compile(sel) {
    var out = { mat: R.I(), inv: false, p: {}, duo: null, stickers: [], game: null }, i, e, k;
    for (i = 0; i < sel.length; i++) {
      e = sel[i];
      if (e.type === "grade") { out.mat = R.mul(R.gradeMatrix(e.g), out.mat); if (e.g.inv) out.inv = true; ["vig","grain"].forEach(function (key) { if (e.g[key]) out.p[key] = Math.max(out.p[key] || 0, e.g[key]); }); }
      else if (e.type === "look") {
        for (k in e.p) {
          if (k === "grade") out.mat = R.mul(R.gradeMatrix(e.p.grade), out.mat);
          else if (MAXKEYS.indexOf(k) >= 0) out.p[k] = Math.max(out.p[k] || 0, e.p[k]);
          else out.p[k] = e.p[k];
        }
      }
      else if (e.type === "duo") out.duo = { c1: e.c1, c2: e.c2 };
      else if (e.type === "sticker") out.stickers.push(e);
      else if (e.type === "game") out.game = e;
    }
    return out;
  }

  /* particles for stickers */
  function Particles() { this.list = []; this.acc = {}; }
  Particles.prototype.update = function (dt, layers) {
    var self = this;
    layers.forEach(function (l) {
      self.acc[l.id] = (self.acc[l.id] || 0) + dt * (l.motion === "burst" ? 5 : 7);
      while (self.acc[l.id] > 1 && self.list.length < 160) { self.acc[l.id]--; self.list.push(spawn(l)); }
    });
    this.list.forEach(function (p) {
      p.age += dt; p.x += p.vx * dt + Math.sin(p.age * p.sw + p.ph) * (p.motion === "drift" ? 40 : 28) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    });
    this.list = this.list.filter(function (p) { return p.age < p.life && p.y > -160 && p.y < H + 160 && p.x > -160 && p.x < W + 160; });
  };
  function spawn(l) {
    var m = l.motion, c = l.chars[Math.floor(Math.random() * l.chars.length)], p = { ch: c, age: 0, ph: Math.random() * 6, sw: 1 + Math.random() * 3, rot: Math.random() * 6, vr: (Math.random() - .5) * 2, size: 40 + Math.random() * 56, motion: m };
    if (m === "rain") { p.x = Math.random() * W; p.y = -60; p.vx = (Math.random() - .5) * 40; p.vy = 260 + Math.random() * 340; p.life = 9; }
    else if (m === "rise") { p.x = Math.random() * W; p.y = H + 60; p.vx = (Math.random() - .5) * 50; p.vy = -(220 + Math.random() * 320); p.life = 9; }
    else if (m === "burst") { p.x = 60 + Math.random() * (W - 120); p.y = 160 + Math.random() * (H - 400); p.vx = 0; p.vy = 0; p.life = 1.2 + Math.random() * .6; p.vr = (Math.random() - .5) * .8; }
    else { p.x = Math.random() < .5 ? -50 : W + 50; p.y = 200 + Math.random() * (H - 500); p.vx = (p.x < 0 ? 1 : -1) * (80 + Math.random() * 120); p.vy = (Math.random() - .5) * 90; p.life = 10; }
    return p;
  }
  Particles.prototype.draw = function (c) {
    this.list.forEach(function (p) {
      var s = p.size, a = 1;
      if (p.motion === "burst") { var k = p.age / p.life; s *= Math.sin(Math.PI * Math.min(1, k)) * 1.3 + .1; a = 1 - Math.max(0, k - .7) / .3; }
      c.globalAlpha = Math.max(0, a); R.emo(c, p.ch, p.x, p.y, s, p.rot); c.globalAlpha = 1;
    });
  };
  Particles.prototype.clear = function () { this.list = []; this.acc = {}; };

  R.Renderer = Renderer; R.compile = compile; R.Particles = Particles;
})();
/* ---------- music: 24 procedurally synthesized tracks + user uploads ---------- */
(function () {
  "use strict";
  var R = window.__VIBIN_FX;
  var SC = { min: [0,2,3,5,7,8,10], maj: [0,2,4,5,7,9,11], pent: [0,2,4,7,9], dor: [0,2,3,5,7,9,10], phr: [0,1,3,5,7,8,10], hmin: [0,2,3,5,7,8,11] };
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function noteOf(cfg, deg, oct) { var s = SC[cfg.scale], n = s.length, o = Math.floor(deg / n); return cfg.root + 12 * oct + s[((deg % n) + n) % n] + 12 * o; }

  var K = { four: "x...x...x...x...", trap: "x.......x.x.....", boom: "x..x....x..x....", dnb: "x.........x.....", half: "x.......x.......", disco: "x...x...x...x...", reg: "x..x..x.x..x..x.", none: "................", skip: "x..x...x..x.x..." };
  var S = { back: "....x.......x...", half: "........x.......", dnb: "....x.......x...", late: "....x.......x..x", none: "................", reg: "...x..x....x..x." };
  var HH = { e8: "x.x.x.x.x.x.x.x.", s16: "xxxxxxxxxxxxxxxx", off: "..x...x...x...x.", trap: "x.xxx.x.x.xxx.xx", sparse: "x...x...x...x...", open: "x.o.x.o.x.o.x.o.", none: "................", roll: "x.x.xxxxx.x.xxxx" };

  var TRACKS = [
    { name: "Lo-fi Study", icon: "☕", g: "chill", bpm: 78, root: 57, scale: "dor", prog: [0,3,4,2], kick: K.skip, snare: S.half, hat: HH.e8, bass: { p: "x.....x...x.....", w: "sine", o: -2 }, pad: { w: "triangle", v: .13 }, lead: { p: "..4...2...5.2...", w: "triangle", o: 0, d: .5, v: .16 }, swing: .18, lp: 3200 },
    { name: "Trap Drip", icon: "💧", g: "trap", bpm: 140, root: 55, scale: "min", prog: [0,5,3,4], kick: K.trap, snare: S.half, hat: HH.trap, clap: S.half, bass: { p: "x.......x.x.....", w: "sine", o: -2, sub: 1 }, pad: { w: "sawtooth", v: .05 }, lead: { p: "4...2.5...4.2...", w: "square", o: 1, d: .25, v: .09 } },
    { name: "House Pump", icon: "🏠", g: "house", bpm: 124, root: 57, scale: "min", prog: [0,0,5,4], kick: K.four, snare: S.none, clap: S.back, hat: HH.off, bass: { p: "..x...x...x...x.", w: "sawtooth", o: -1 }, pad: { w: "sawtooth", v: .09 }, lead: { p: "x.x..x.x..x.x...".replace(/x/g, "4"), w: "square", o: 1, d: .15, v: .08 } },
    { name: "Synthwave Night", icon: "🌃", g: "retro", bpm: 100, root: 52, scale: "min", prog: [0,5,2,4], kick: K.half, snare: S.back, hat: HH.e8, bass: { p: "x.x.x.x.x.x.x.x.", w: "sawtooth", o: -2 }, pad: { w: "sawtooth", v: .1 }, lead: { p: "4.7.9.7.4.5.7.4.".replace(/\d/g, function (d) { return String(Number(d) % 7); }), w: "sawtooth", o: 1, d: .3, v: .09 } },
    { name: "Phonk Drift", icon: "🏎️", g: "phonk", bpm: 130, root: 53, scale: "phr", prog: [0,0,1,0], kick: K.boom, snare: S.back, hat: HH.roll, bass: { p: "x..x..x.x..x....", w: "square", o: -2, sub: 1 }, pad: { w: "sawtooth", v: .05 }, lead: { p: "4..2..1..4..2.1.", w: "square", o: 1, d: .2, v: .1 }, lp: 6000 },
    { name: "Happy Pop", icon: "🌞", g: "pop", bpm: 118, root: 60, scale: "maj", prog: [0,4,5,3], kick: K.four, snare: S.back, hat: HH.e8, bass: { p: "x...x...x...x...", w: "triangle", o: -2 }, pad: { w: "triangle", v: .13 }, lead: { p: "4.2.4.5.7.5.4.2.", w: "triangle", o: 1, d: .3, v: .16 } },
    { name: "8-bit Quest", icon: "👾", g: "chiptune", bpm: 132, root: 60, scale: "maj", prog: [0,3,4,0], kick: K.disco, snare: S.back, hat: HH.s16, bass: { p: "x.x.x.x.x.x.x.x.", w: "square", o: -2 }, pad: { w: "square", v: .04 }, lead: { p: "4.5.7.9.7.5.4.2.", w: "square", o: 1, d: .12, v: .1 } },
    { name: "Reggaeton Heat", icon: "🌴", g: "latin", bpm: 96, root: 57, scale: "min", prog: [0,3,4,0], kick: K.reg, snare: S.reg, hat: HH.sparse, bass: { p: "x..x..x.x..x..x.", w: "sine", o: -2, sub: 1 }, pad: { w: "triangle", v: .08 }, lead: { p: "4..2.4..5..4.2..", w: "triangle", o: 1, d: .22, v: .13 } },
    { name: "Dream Ambient", icon: "☁️", g: "ambient", bpm: 70, root: 55, scale: "maj", prog: [0,5,3,4], kick: K.none, snare: S.none, hat: HH.none, bass: { p: "x...............", w: "sine", o: -2 }, pad: { w: "sine", v: .22 }, lead: { p: "4.......7.......", w: "sine", o: 1, d: 1.2, v: .13 } },
    { name: "Drill Bounce", icon: "🥶", g: "drill", bpm: 142, root: 54, scale: "min", prog: [0,0,5,4], kick: K.boom, snare: S.half, hat: HH.trap, bass: { p: "x.....x...x.....", w: "sine", o: -2, sub: 1 }, pad: { w: "sawtooth", v: .05 }, lead: { p: "4..4..2..5..4...", w: "triangle", o: 1, d: .3, v: .12 } },
    { name: "Funk Groove", icon: "🕺", g: "funk", bpm: 108, root: 52, scale: "dor", prog: [0,3,0,4], kick: K.skip, snare: S.back, hat: HH.s16, bass: { p: "x.xx.x.xx.x.xx.x", w: "sawtooth", o: -2 }, pad: { w: "triangle", v: .07 }, lead: { p: "4.4.5.7.4.2.4.5.", w: "square", o: 1, d: .18, v: .08 }, swing: .1 },
    { name: "EDM Festival", icon: "🎆", g: "edm", bpm: 128, root: 57, scale: "min", prog: [0,5,3,4], kick: K.four, snare: S.none, clap: S.back, hat: HH.off, bass: { p: "x.x.x.x.x.x.x.x.", w: "sawtooth", o: -1 }, pad: { w: "sawtooth", v: .12 }, lead: { p: "4.4.4.2.5.5.5.4.", w: "sawtooth", o: 1, d: .25, v: .1 } },
    { name: "Disco Fever", icon: "🪩", g: "disco", bpm: 116, root: 57, scale: "dor", prog: [0,3,4,3], kick: K.disco, snare: S.back, hat: HH.open, bass: { p: "x.xxx.xxx.xxx.xx", w: "sawtooth", o: -2 }, pad: { w: "triangle", v: .1 }, lead: { p: "4.7.9.7.4.7.9.7.".replace(/\d/g, function (d) { return String(Number(d) % 7); }), w: "triangle", o: 1, d: .2, v: .12 } },
    { name: "Soft Pluck", icon: "🪕", g: "acoustic", bpm: 92, root: 55, scale: "maj", prog: [0,4,5,3], kick: K.half, snare: S.none, hat: HH.none, bass: { p: "x.......x.......", w: "triangle", o: -2 }, pad: { w: "triangle", v: .06 }, lead: { p: "4.2.4.7.5.2.4.2.", w: "triangle", o: 1, d: .5, v: .2 } },
    { name: "Horror Pulse", icon: "🧟", g: "dark", bpm: 84, root: 50, scale: "hmin", prog: [0,0,1,0], kick: K.half, snare: S.none, hat: HH.sparse, bass: { p: "x.x.x.x.x.x.x.x.", w: "sawtooth", o: -2 }, pad: { w: "sawtooth", v: .08 }, lead: { p: "4.......2.......", w: "sine", o: 1, d: 1, v: .13 }, lp: 2400 },
    { name: "Hyperpop Glitch", icon: "🦄", g: "hyperpop", bpm: 160, root: 62, scale: "maj", prog: [0,4,3,5], kick: K.four, snare: S.back, hat: HH.s16, clap: S.back, bass: { p: "x.x.x.x.x.x.x.x.", w: "square", o: -1 }, pad: { w: "sawtooth", v: .07 }, lead: { p: "4.5.7.9.9.7.5.4.", w: "square", o: 2, d: .1, v: .09 } },
    { name: "Waltz Time", icon: "💃", g: "classic", bpm: 90, root: 57, scale: "min", prog: [0,3,4,0], kick: K.half, snare: S.none, hat: HH.none, bass: { p: "x...........x...", w: "triangle", o: -2 }, pad: { w: "triangle", v: .16 }, lead: { p: "4...5...7...5...", w: "triangle", o: 1, d: .6, v: .16 } },
    { name: "Jazz Cafe", icon: "🎷", g: "jazz", bpm: 98, root: 53, scale: "dor", prog: [1,4,0,0], kick: K.skip, snare: S.late, hat: HH.open, bass: { p: "x..x..x.x..x..x.", w: "triangle", o: -2 }, pad: { w: "triangle", v: .12 }, lead: { p: "4.2.5..4.7..2.4.", w: "sine", o: 1, d: .4, v: .15 }, swing: .22 },
    { name: "Epic Cinematic", icon: "🎬", g: "cinematic", bpm: 96, root: 50, scale: "min", prog: [0,5,2,4], kick: K.half, snare: S.half, hat: HH.none, bass: { p: "x...............", w: "sawtooth", o: -2 }, pad: { w: "sawtooth", v: .18 }, lead: { p: "4.......7.......", w: "sawtooth", o: 1, d: 1.3, v: .09 } },
    { name: "Bossa Breeze", icon: "🏝️", g: "bossa", bpm: 112, root: 55, scale: "maj", prog: [0,5,1,4], kick: K.reg, snare: S.none, hat: HH.sparse, bass: { p: "x..x..x.x..x..x.", w: "triangle", o: -2 }, pad: { w: "triangle", v: .1 }, lead: { p: "4..2..4.5..7..5.", w: "sine", o: 1, d: .4, v: .15 }, swing: .08 },
    { name: "Ukulele Sunshine", icon: "🌻", g: "folk", bpm: 120, root: 60, scale: "maj", prog: [0,3,0,4], kick: K.half, snare: S.back, hat: HH.e8, bass: { p: "x...x...x...x...", w: "triangle", o: -2 }, pad: { w: "triangle", v: .05 }, lead: { p: "4.4.5.4.2.4.5.7.", w: "triangle", o: 1, d: .22, v: .17 } },
    { name: "DnB Rush", icon: "🚀", g: "dnb", bpm: 172, root: 52, scale: "min", prog: [0,5,3,4], kick: K.dnb, snare: S.dnb, hat: HH.s16, bass: { p: "x.x...x.x.x...x.", w: "sawtooth", o: -2, sub: 1 }, pad: { w: "sawtooth", v: .07 }, lead: { p: "4.2.4.5.4.2.7.5.", w: "square", o: 1, d: .12, v: .07 } },
    { name: "Slowed + Reverb", icon: "🌙", g: "slowed", bpm: 66, root: 57, scale: "min", prog: [0,5,2,4], kick: K.half, snare: S.half, hat: HH.sparse, bass: { p: "x.......x.......", w: "sine", o: -2, sub: 1 }, pad: { w: "sawtooth", v: .12 }, lead: { p: "4.....2.....5...", w: "triangle", o: 1, d: 1, v: .15 }, lp: 2800 },
    { name: "Kawaii Bounce", icon: "🍡", g: "cute", bpm: 136, root: 65, scale: "pent", prog: [0,2,3,1], kick: K.disco, snare: S.back, hat: HH.e8, bass: { p: "x.x.x.x.x.x.x.x.", w: "triangle", o: -2 }, pad: { w: "triangle", v: .08 }, lead: { p: "4.2.3.2.4.2.1.2.", w: "square", o: 1, d: .14, v: .1 } }
  ].map(function (t, i) { t.id = "t" + i; return t; });

  function render(cfg) {
    var sr = 44100, step = 60 / cfg.bpm / 4, barSec = step * 16, bars = Math.ceil(26 / barSec / 4) * 4, steps = bars * 16, len = Math.round(steps * step * sr);
    var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, oc = new OC(2, len, sr), i;
    var master = oc.createGain(); master.gain.value = .85;
    var lp = oc.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = cfg.lp || 18000;
    var comp = oc.createDynamicsCompressor(); master.connect(lp); lp.connect(comp); comp.connect(oc.destination);
    var delay = oc.createDelay(1); delay.delayTime.value = step * 3; var fb = oc.createGain(); fb.gain.value = .34; var wet = oc.createGain(); wet.gain.value = .35;
    delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
    var nb = oc.createBuffer(1, sr, sr), nd = nb.getChannelData(0); for (i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;

    function env(g, t, a, d, pk) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(pk, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
    function osc(type, f, t, dur, vol, a, send, detune) {
      var o = oc.createOscillator(), g = oc.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (detune) o.detune.value = detune;
      env(g, t, a, dur, vol); o.connect(g); g.connect(master); if (send) g.connect(delay); o.start(t); o.stop(t + a + dur + .05); return o;
    }
    function noise(t, dur, vol, type, freq, q) {
      var s = oc.createBufferSource(), f = oc.createBiquadFilter(), g = oc.createGain(); s.buffer = nb; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      env(g, t, .002, dur, vol); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
    }
    function kick(t) { var o = oc.createOscillator(), g = oc.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + .13); env(g, t, .002, .3, .95); o.connect(g); g.connect(master); o.start(t); o.stop(t + .4); }
    function snare(t) { noise(t, .18, .42, "bandpass", 1900, .7); osc("triangle", 190, t, .1, .25, .002); }
    function clap(t) { noise(t, .05, .3, "bandpass", 1500, 1); noise(t + .012, .05, .3, "bandpass", 1500, 1); noise(t + .026, .16, .32, "bandpass", 1500, 1); }
    function hat(t, open) { noise(t, open ? .16 : .04, open ? .15 : .12, "highpass", 7500); }

    for (var s = 0; s < steps; s++) {
      var sb = s % 16, bar = Math.floor(s / 16), deg = cfg.prog[bar % cfg.prog.length];
      var t = s * step + ((s % 2) ? (cfg.swing || 0) * step : 0);
      if (cfg.kick[sb] === "x") kick(t);
      if (cfg.snare && cfg.snare[sb] === "x") snare(t);
      if (cfg.clap && cfg.clap[sb] === "x") clap(t);
      if (cfg.hat[sb] === "x") hat(t, false); else if (cfg.hat[sb] === "o") hat(t, true);
      var bp = cfg.bass.p[sb];
      if (bp && bp !== ".") {
        var bf = mtof(noteOf(cfg, deg, cfg.bass.o || -2));
        if (cfg.bass.sub) { var so = oc.createOscillator(), sg = oc.createGain(); so.type = "sine"; so.frequency.setValueAtTime(bf * 1.4, t); so.frequency.exponentialRampToValueAtTime(bf, t + .06); env(sg, t, .005, step * 3.4, .9); so.connect(sg); sg.connect(master); so.start(t); so.stop(t + step * 4); }
        else { var bo = oc.createOscillator(), bg = oc.createGain(), bfl = oc.createBiquadFilter(); bo.type = cfg.bass.w; bo.frequency.value = bf; bfl.type = "lowpass"; bfl.frequency.value = 520; env(bg, t, .005, step * 1.8, .5); bo.connect(bfl); bfl.connect(bg); bg.connect(master); bo.start(t); bo.stop(t + step * 2.2); }
      }
      if (sb === 0 && cfg.pad && cfg.pad.v) {
        [0, 2, 4].forEach(function (c) {
          [-6, 6].forEach(function (dt) { var po = oc.createOscillator(), pg = oc.createGain(), pf = oc.createBiquadFilter(); po.type = cfg.pad.w; po.frequency.value = mtof(noteOf(cfg, deg + c, 0)); po.detune.value = dt; pf.type = "lowpass"; pf.frequency.value = 1400;
            pg.gain.setValueAtTime(0.0001, t); pg.gain.linearRampToValueAtTime(cfg.pad.v / 2, t + barSec * .25); pg.gain.linearRampToValueAtTime(0.0001, t + barSec * .98); po.connect(pf); pf.connect(pg); pg.connect(master); pg.connect(delay); po.start(t); po.stop(t + barSec); });
        });
      }
      var lc = cfg.lead.p[sb];
      if (lc && lc !== ".") { var ld = deg + Number(lc); osc(cfg.lead.w, mtof(noteOf(cfg, ld, cfg.lead.o)), t, cfg.lead.d, cfg.lead.v, .004, true); }
    }
    return oc.startRendering();
  }

  var cache = {};
  R.Music = {
    TRACKS: TRACKS,
    get: function (id) { return TRACKS.filter(function (t) { return t.id === id; })[0]; },
    render: function (id) {
      if (cache[id]) return cache[id];
      var cfg = R.Music.get(id);
      cache[id] = new Promise(function (res, rej) { setTimeout(function () { try { render(cfg).then(res, rej); } catch (e) { rej(e); } }, 30); });
      cache[id].catch(function () { delete cache[id]; });
      return cache[id];
    }
  };
})();
/* ---------- studio UI ---------- */
(function () {
  "use strict";
  var R = window.__VIBIN_FX, W = R.W, H = R.H, FX = R.FX;
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmtT(s) { s = Math.floor(s); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }

  var CSS = `
.vs{position:fixed;inset:0;z-index:80;background:#000;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;-webkit-user-select:none;user-select:none}
.vs *{box-sizing:border-box}
:where(.vs) button{font:inherit;color:inherit;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
:where(.vs) input{font:inherit;color:inherit}
.vs [hidden]{display:none!important}
.vs-frame{position:relative;width:min(100vw,calc(100dvh*9/16));height:min(100dvh,calc(100vw*16/9));background:#111;overflow:hidden}
@media(min-width:700px){.vs-frame{border-radius:18px}}
.vs-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none}
.vs-layer{position:absolute;inset:0;pointer-events:none}
.vs-layer button,.vs-layer input,.vs-layer .vs-tray,.vs-layer .vs-strip,.vs-layer .vs-active{pointer-events:auto}
.vs-top{position:absolute;top:0;left:0;right:0;padding:calc(10px + env(safe-area-inset-top)) 12px 0;display:flex;align-items:center;justify-content:space-between;gap:8px}
.vs-round{width:42px;height:42px;border-radius:50%;background:rgba(0,0,0,.42);display:grid;place-items:center;font-size:19px;backdrop-filter:blur(8px)}
.vs-pill{padding:8px 14px;border-radius:999px;background:rgba(0,0,0,.42);font-weight:700;font-size:.82rem;backdrop-filter:blur(8px);white-space:nowrap}
.vs-rec{background:rgba(235,40,60,.85)}
.vs-side{position:absolute;right:10px;top:calc(72px + env(safe-area-inset-top));display:flex;flex-direction:column;gap:16px;align-items:center}
.vs-side button{display:flex;flex-direction:column;align-items:center;gap:1px;font-size:.66rem;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.vs-side button b{font-size:25px;font-weight:400;filter:drop-shadow(0 1px 3px rgba(0,0,0,.7))}
.vs-active{position:absolute;left:10px;right:66px;top:calc(62px + env(safe-area-inset-top));display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}
.vs-active::-webkit-scrollbar{display:none}
.vs-chip{flex:none;padding:5px 10px;border-radius:999px;background:rgba(0,0,0,.5);font-size:.74rem;font-weight:700;backdrop-filter:blur(8px)}
.vs-bottom{position:absolute;left:0;right:0;bottom:0;padding:0 14px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;align-items:center;gap:12px;background:linear-gradient(transparent,rgba(0,0,0,.5))}
.vs-modes{display:flex;gap:6px}
.vs-modes button{padding:6px 14px;border-radius:999px;font-weight:700;font-size:.85rem;color:rgba(255,255,255,.7)}
.vs-modes button.on{background:rgba(255,255,255,.95);color:#000}
.vs-row{display:flex;align-items:center;justify-content:space-between;width:100%;max-width:380px}
.vs-sbtn{width:64px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:.68rem;font-weight:700;text-shadow:0 1px 4px rgba(0,0,0,.8)}
.vs-sbtn b{width:46px;height:46px;border-radius:12px;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:24px;font-weight:400;backdrop-filter:blur(8px);border:2px solid rgba(255,255,255,.7)}
.vs-shutter{width:84px;height:84px;border-radius:50%;padding:6px;background:conic-gradient(var(--accent,#ff6a88) calc(var(--p,0)*1%),rgba(255,255,255,.85) 0);display:grid;place-items:center}
.vs-shutter i{display:block;width:100%;height:100%;border-radius:50%;background:#fff;border:4px solid #111;transition:all .15s}
.vs-shutter.vid i{background:var(--like,#ff2d55)}
.vs-shutter.rec i{border-radius:14px;width:44%;height:44%;background:var(--like,#ff2d55);border:0}
.vs-strip{display:flex;gap:6px;overflow-x:auto;max-width:100%;scrollbar-width:none;align-items:center}
.vs-strip::-webkit-scrollbar{display:none}
.vs-strip img{width:38px;height:56px;object-fit:cover;border-radius:6px;border:2px solid #fff;flex:none}
.vs-next{padding:9px 20px;border-radius:999px;font-weight:800;background:linear-gradient(90deg,var(--accent,#ff6a88),var(--accent2,#8e54e9));flex:none}
.vs-count{position:absolute;inset:0;display:grid;place-items:center;font-size:150px;font-weight:900;text-shadow:0 4px 30px rgba(0,0,0,.7);pointer-events:none}
.vs-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
.vs-flash.go{animation:vsflash .25s}
@keyframes vsflash{0%{opacity:.85}100%{opacity:0}}
.vs-frame.tray-open .vs-bottom,.vs-frame.tray-open .vs-side{display:none}
.vs-tray{position:absolute;left:0;right:0;bottom:0;height:54%;background:rgba(16,16,20,.94);backdrop-filter:blur(14px);border-radius:20px 20px 0 0;transform:translateY(102%);transition:transform .25s;display:flex;flex-direction:column;padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
.vs-frame.tray-open .vs-tray{transform:none}
.vs-thead{display:flex;gap:8px;align-items:center;margin-bottom:8px}
.vs-search{flex:1;min-width:0;background:rgba(255,255,255,.1);border:0;outline:0;border-radius:999px;padding:9px 14px;font-size:.9rem}
.vs-tabs{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;margin-bottom:8px}
.vs-tabs::-webkit-scrollbar{display:none}
.vs-tabs button{flex:none;padding:7px 12px;border-radius:999px;font-weight:700;font-size:.8rem;color:rgba(255,255,255,.65);background:rgba(255,255,255,.07)}
.vs-tabs button.on{background:#fff;color:#000}
.vs-tabs small{opacity:.6;margin-left:4px}
.vs-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:8px}
.vs-chips::-webkit-scrollbar{display:none}
.vs-chips button{flex:none;padding:5px 11px;border-radius:999px;font-size:.74rem;font-weight:700;background:rgba(255,255,255,.07);color:rgba(255,255,255,.75)}
.vs-chips button.on{background:var(--accent2,#8e54e9);color:#fff}
.vs-grid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:12px 8px;align-content:start;padding:2px 2px 8px}
.vs-item{display:flex;flex-direction:column;align-items:center;gap:5px;position:relative}
.vs-ic{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;font-size:28px;background:rgba(255,255,255,.1);border:3px solid transparent;transition:border-color .15s,transform .15s}
.vs-item.on .vs-ic{border-color:var(--accent,#ff6a88);transform:scale(1.06)}
.vs-item.on::after{content:"\\2713";position:absolute;top:-2px;right:6px;width:20px;height:20px;border-radius:50%;background:var(--accent,#ff6a88);font-size:12px;display:grid;place-items:center;font-weight:800}
.vs-nm{font-size:.66rem;font-weight:600;text-align:center;line-height:1.15;max-width:72px;color:rgba(255,255,255,.85)}
.vs-empty{grid-column:1/-1;text-align:center;color:rgba(255,255,255,.5);padding:24px}
.vs-rev{position:absolute;inset:0;background:#000;display:flex;flex-direction:column}
.vs-stage{position:relative;flex:1;min-height:0;background:#000;display:grid;place-items:center}
.vs-stage video,.vs-stage img.vs-big{width:100%;height:100%;object-fit:cover;background:#000}
.vs-rtop{position:absolute;top:0;left:0;right:0;padding:calc(10px + env(safe-area-inset-top)) 12px 0;display:flex;align-items:center;justify-content:space-between;gap:8px;z-index:3}
.vs-song{display:flex;align-items:center;gap:8px;max-width:60%;padding:9px 16px;border-radius:999px;background:rgba(0,0,0,.5);backdrop-filter:blur(10px);font-weight:800;font-size:.88rem}
.vs-song span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.vs-rbot{position:absolute;left:0;right:0;bottom:0;padding:12px 14px calc(14px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:10px;background:linear-gradient(transparent,rgba(0,0,0,.65));z-index:3}
.vs-rbtns{display:flex;gap:10px}
.vs-rbtns button{flex:1;padding:14px;border-radius:12px;font-weight:800;background:rgba(255,255,255,.16)}
.vs-rbtns button.main{background:linear-gradient(90deg,var(--accent,#ff6a88),var(--accent2,#8e54e9))}
.vs-thumbs{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
.vs-thumbs div{position:relative;flex:none}
.vs-thumbs img{width:48px;height:72px;object-fit:cover;border-radius:8px;border:2px solid transparent;display:block}
.vs-thumbs img.on{border-color:#fff}
.vs-thumbs button{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#000;font-size:11px;border:1px solid #fff;display:grid;place-items:center}
.vs-hint{font-size:.78rem;color:rgba(255,255,255,.75);text-align:center}
.vs-sheet{position:absolute;left:0;right:0;bottom:0;height:72%;background:rgba(18,18,22,.97);border-radius:20px 20px 0 0;z-index:6;display:flex;flex-direction:column;padding:14px 14px calc(12px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px rgba(0,0,0,.6)}
.vs-sh{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.vs-sh h3{font-size:1.1rem}
.vs-vol{display:flex;align-items:center;gap:10px;font-size:.8rem;font-weight:700;margin-bottom:6px}
.vs-vol span{width:104px;flex:none}
.vs-vol input{flex:1;accent-color:var(--accent,#ff6a88)}
.vs-own{margin:6px 0 8px;padding:11px;border-radius:12px;background:rgba(255,255,255,.1);font-weight:700;font-size:.88rem}
.vs-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:4px}
.vs-track{display:flex;align-items:center;gap:12px;padding:8px 10px;border-radius:12px;text-align:left;width:100%}
.vs-track:hover{background:rgba(255,255,255,.06)}
.vs-track.on{background:rgba(255,255,255,.12);outline:2px solid var(--accent,#ff6a88)}
.vs-track .tic{width:44px;height:44px;border-radius:10px;background:rgba(255,255,255,.1);display:grid;place-items:center;font-size:22px;flex:none}
.vs-track b{display:block;font-size:.92rem}
.vs-track small{color:rgba(255,255,255,.55);font-size:.75rem}
.vs-track .st{margin-left:auto;font-size:.78rem;color:rgba(255,255,255,.7)}
.vs-busy{position:absolute;inset:0;background:rgba(0,0,0,.82);z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:30px;text-align:center}
.vs-busy .bar{width:70%;height:8px;border-radius:99px;background:rgba(255,255,255,.18);overflow:hidden}
.vs-busy .bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--accent,#ff6a88),var(--accent2,#8e54e9))}
.vs-busy button{padding:10px 22px;border-radius:999px;background:rgba(255,255,255,.16);font-weight:700}
.vs-ghost{width:42px;height:42px}
`;
  var cssDone = false;
  function injectCSS() { if (cssDone) return; var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s); cssDone = true; }

  /* ---------- audio manager ---------- */
  var AP = { ac: null, src: null, gain: null };
  function actx() { if (!AP.ac) { var C = window.AudioContext || window.webkitAudioContext; AP.ac = new C(); } if (AP.ac.state === "suspended") AP.ac.resume(); return AP.ac; }
  function stopBuf() { try { if (AP.src) AP.src.stop(); } catch (e) {} AP.src = null; }
  function playBuf(buf, vol) { stopBuf(); var a = actx(), s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; s.loop = true; g.gain.value = vol; s.connect(g); g.connect(a.destination); s.start(); AP.src = s; AP.gain = g; }
  function decode(ab) { return new Promise(function (res, rej) { var p = actx().decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); }); }

  var MIMES = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
  function pickMime() { if (!window.MediaRecorder) return ""; for (var i = 0; i < MIMES.length; i++) { try { if (MediaRecorder.isTypeSupported(MIMES[i])) return MIMES[i]; } catch (e) {} } return ""; }
  function baseType(m) { return (m || "video/webm").split(";")[0]; }
  function extOf(m) { return /mp4/.test(m) ? "mp4" : "webm"; }

  function drawCover(c, img, iw, ih, zoom, alpha) {
    if (!iw || !ih) return;
    var ar = W / H, sa = iw / ih, sw, sh;
    if (sa > ar) { sh = ih; sw = ih * ar; } else { sw = iw; sh = iw / ar; }
    sw /= zoom; sh /= zoom; c.globalAlpha = alpha == null ? 1 : alpha; c.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, W, H); c.globalAlpha = 1;
  }
  function cssFilter(sel) {
    var g = sel.filter(function (e) { return e.type === "grade"; })[0]; if (!g) return "none"; var q = g.g;
    return "brightness(" + (q.b || 1) + ") contrast(" + (q.c || 1) + ") saturate(" + (q.s == null ? 1 : q.s) + ") hue-rotate(" + (q.h || 0) + "deg) sepia(" + (q.sep || 0) + ")" + (q.inv ? " invert(1)" : "");
  }

  var S = null, rend = null;
  function toast(m) { if (S && S.opts.toast) S.opts.toast(m); else try { console.log(m); } catch (e) {} }

  /* ---------- open / build ---------- */
  function open(opts) {
    if (S) return;
    injectCSS();
    S = { opts: opts || {}, sel: [], fx: R.compile([]), facing: "user", mode: "v15", timer: 0, photos: [], view: "cam", recording: false, tab: "grade", eng: "all", q: "", musicVol: .85, origVol: 1, items: {}, pickTok: 0, mime: pickMime(), parts: new R.Particles(), music: null };
    if (!rend) rend = new R.Renderer();
    build(); setTab("grade"); renderActive(); startCamera();
    S.raf = requestAnimationFrame(loop);
    document.addEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape" && S) { if (S.d.frame.classList.contains("tray-open")) toggleTray(false); else if (!S.busy) close(); } }

  function build() {
    var d = S.d = {};
    d.root = el("div", "vs"); d.frame = el("div", "vs-frame"); d.root.appendChild(d.frame);
    d.canvas = el("canvas", "vs-canvas"); d.canvas.width = W; d.canvas.height = H; d.ctx = d.canvas.getContext("2d"); d.frame.appendChild(d.canvas);
    d.fb = document.createElement("canvas"); d.fb.width = 360; d.fb.height = 640; d.fbx = d.fb.getContext("2d");
    d.vid = document.createElement("video"); d.vid.muted = true; d.vid.playsInline = true; d.vid.setAttribute("playsinline", ""); d.vid.style.cssText = "position:absolute;width:2px;height:2px;opacity:0;pointer-events:none"; d.root.appendChild(d.vid);

    var cam = d.cam = el("div", "vs-layer");
    cam.innerHTML =
      '<div class="vs-top"><button class="vs-round" data-a="close" aria-label="Close">\u2715</button><div class="vs-pill" data-r="pill">\u2728 ' + FX.length + ' effects</div><div class="vs-ghost"></div></div>' +
      '<div class="vs-active" data-r="active"></div>' +
      '<div class="vs-side"><button data-a="flip"><b>\uD83D\uDD04</b>Flip</button><button data-a="timer"><b>\u23F1\uFE0F</b><span data-r="tl">Off</span></button><button data-a="surprise"><b>\uD83C\uDFB2</b>Surprise</button><button data-a="clear"><b>\uD83E\uDDF9</b>Reset</button></div>' +
      '<div class="vs-count" data-r="count" hidden></div><div class="vs-flash" data-r="flash"></div>' +
      '<div class="vs-bottom"><div class="vs-strip" data-r="strip" hidden></div>' +
      '<div class="vs-modes" data-r="modes"><button data-m="photo">Photo</button><button data-m="v15" class="on">15s</button><button data-m="v60">60s</button></div>' +
      '<div class="vs-row"><button class="vs-sbtn" data-a="fx"><b>\uD83D\uDE0E</b>Effects</button><button class="vs-shutter vid" data-r="shutter" aria-label="Record"><i></i></button><button class="vs-sbtn" data-a="upload"><b>\uD83D\uDDBC\uFE0F</b>Upload</button></div></div>' +
      '<div class="vs-tray" data-r="tray"><div class="vs-thead"><input class="vs-search" data-r="search" type="search" placeholder="Search ' + FX.length + ' effects" autocomplete="off"><button class="vs-round" data-a="trayclose" aria-label="Close effects">\u2304</button></div>' +
      '<div class="vs-tabs" data-r="tabs"></div><div class="vs-chips" data-r="chips" hidden></div><div class="vs-grid" data-r="grid"></div></div>';
    d.frame.appendChild(cam);
    var q = function (n) { return cam.querySelector('[data-r="' + n + '"]'); };
    d.pill = q("pill"); d.active = q("active"); d.tl = q("tl"); d.count = q("count"); d.flash = q("flash"); d.strip = q("strip"); d.modes = q("modes"); d.shutter = q("shutter"); d.tray = q("tray"); d.search = q("search"); d.tabs = q("tabs"); d.chips = q("chips"); d.grid = q("grid");

    cam.addEventListener("click", function (e) {
      var b = e.target.closest("[data-a]"), m = e.target.closest("[data-m]");
      if (m && !S.recording) { S.mode = m.dataset.m; syncMode(); return; }
      if (!b) return;
      var a = b.dataset.a;
      if (a === "close") close();
      else if (a === "flip") { if (!S.recording) { S.facing = S.facing === "user" ? "environment" : "user"; startCamera(); } }
      else if (a === "timer") { S.timer = S.timer === 0 ? 3 : S.timer === 3 ? 10 : 0; d.tl.textContent = S.timer ? S.timer + "s" : "Off"; }
      else if (a === "surprise") surprise();
      else if (a === "clear") { S.sel = []; recompute(); }
      else if (a === "fx") toggleTray(true);
      else if (a === "trayclose") toggleTray(false);
      else if (a === "upload") { var cb = S.opts.onUpload; close(); if (cb) cb(); }
    });
    d.shutter.addEventListener("click", onShutter);
    d.search.addEventListener("input", function () { S.q = d.search.value.trim().toLowerCase(); renderGrid(); });

    /* pointer -> game */
    var pt = function (e) { var r = d.canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
    d.canvas.addEventListener("pointerdown", function (e) { if (!S.game) return; var p = pt(e); try { d.canvas.setPointerCapture(e.pointerId); } catch (x) {} S.game.down(p[0], p[1]); });
    d.canvas.addEventListener("pointermove", function (e) { if (!S.game || !(e.buttons || e.pointerType === "touch")) return; var p = pt(e); S.game.move(p[0], p[1]); });

    document.body.appendChild(d.root);
    syncMode();
  }

  function syncMode() {
    var d = S.d;
    d.modes.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.dataset.m === S.mode); });
    d.shutter.classList.toggle("vid", S.mode !== "photo");
    renderStrip();
  }
  function toggleTray(on) { S.d.frame.classList.toggle("tray-open", !!on); }

  /* ---------- effects tray ---------- */
  var TABS = [["grade", "Filters"], ["look", "Looks"], ["duo", "Duotone"], ["sticker", "Stickers"], ["game", "Minigames"]];
  function setTab(t) {
    S.tab = t; S.eng = "all"; var d = S.d; d.tabs.textContent = "";
    TABS.forEach(function (x) {
      var n = FX.filter(function (e) { return e.type === x[0]; }).length, b = el("button", x[0] === t ? "on" : "", x[1] + "<small>" + n + "</small>");
      b.addEventListener("click", function () { setTab(x[0]); }); d.tabs.appendChild(b);
    });
    d.chips.textContent = ""; d.chips.hidden = t !== "game";
    if (t === "game") {
      var all = [{ key: "all", label: "All games", icon: "\uD83C\uDFAE" }].concat(R.ENGINES);
      all.forEach(function (en) { var b = el("button", en.key === "all" ? "on" : ""); b.textContent = en.icon + " " + en.label; b.addEventListener("click", function () { S.eng = en.key; d.chips.querySelectorAll("button").forEach(function (c) { c.classList.toggle("on", c === b); }); renderGrid(); }); d.chips.appendChild(b); });
    }
    renderGrid();
  }
  function swatchCss(e) {
    if (e.css) return e.css;
    if (e.type === "grade" && e.swatch) { var c = e.swatch.map(function (v) { return Math.round(clamp((v - .7) / .6, 0, 1) * 190 + 50); }); return "linear-gradient(135deg,rgb(" + c.join(",") + "),rgb(" + c.map(function (v) { return Math.round(v * .45); }).join(",") + "))"; }
    return "";
  }
  function renderGrid() {
    var d = S.d; d.grid.textContent = ""; S.items = {};
    var list = FX.filter(function (e) { return (S.q ? true : e.type === S.tab) && (S.tab !== "game" || S.q || S.eng === "all" || e.engine === S.eng) && (!S.q || e.name.toLowerCase().indexOf(S.q) >= 0); });
    if (!list.length) { d.grid.appendChild(el("div", "vs-empty", "No effects match that")); return; }
    var frag = document.createDocumentFragment();
    list.forEach(function (e) {
      var b = el("button", "vs-item" + (S.sel.indexOf(e) >= 0 ? " on" : "")), ic = el("span", "vs-ic"), nm = el("span", "vs-nm");
      ic.textContent = e.icon; var sw = swatchCss(e); if (sw) ic.style.background = sw; nm.textContent = e.name;
      b.appendChild(ic); b.appendChild(nm); b.addEventListener("click", function () { toggleFx(e); });
      S.items[e.id] = b; frag.appendChild(b);
    });
    d.grid.appendChild(frag);
  }
  function toggleFx(e) {
    var i = S.sel.indexOf(e);
    if (i >= 0) S.sel.splice(i, 1);
    else {
      if (e.type === "duo" || e.type === "game") S.sel = S.sel.filter(function (x) { return x.type !== e.type; });
      if (S.sel.length >= 8) { toast("Max 8 effects at once"); return; }
      S.sel.push(e);
    }
    recompute();
  }
  function recompute() {
    S.fx = R.compile(S.sel); var g = S.fx.game;
    if (g) { if (S.gameFx !== g) { S.gameFx = g; S.game = g.make(); } } else { S.gameFx = null; S.game = null; }
    if (!S.fx.stickers.length) S.parts.clear();
    Object.keys(S.items).forEach(function (id) { var e = FX.filter(function (x) { return x.id === id; })[0]; if (e && S.items[id]) S.items[id].classList.toggle("on", S.sel.indexOf(e) >= 0); });
    renderActive();
  }
  function renderActive() {
    var d = S.d; d.active.textContent = "";
    S.sel.forEach(function (e) { var c = el("button", "vs-chip"); c.textContent = e.icon + " " + e.name + "  \u2715"; c.addEventListener("click", function () { toggleFx(e); }); d.active.appendChild(c); });
    d.pill.textContent = S.sel.length ? "\u2728 " + S.sel.length + " on" : "\u2728 " + FX.length + " effects";
  }
  function surprise() {
    function rp(t) { var l = FX.filter(function (e) { return e.type === t; }); return l[Math.floor(Math.random() * l.length)]; }
    S.sel = [rp("grade"), rp("look")];
    if (Math.random() < .5) S.sel.push(rp("sticker"));
    if (Math.random() < .3) S.sel.push(rp("duo"));
    if (Math.random() < .35) S.sel.push(rp("game"));
    recompute();
  }

  /* ---------- camera ---------- */
  function stopCamera() { if (S.stream) { S.stream.getTracks().forEach(function (t) { t.stop(); }); S.stream = null; } S.d.vid.srcObject = null; }
  async function startCamera() {
    stopCamera(); var d = S.d, tok = S.camTok = (S.camTok || 0) + 1, st = null;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("Camera isn't available here, using studio background"); return; }
    var v = { facingMode: S.facing, width: { ideal: 1280 }, height: { ideal: 720 } };
    try { st = await navigator.mediaDevices.getUserMedia({ video: v, audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (e) { try { st = await navigator.mediaDevices.getUserMedia({ video: v, audio: false }); toast("Mic is off, video will have no sound"); } catch (e2) { toast("Camera blocked, using studio background"); } }
    if (!S || tok !== S.camTok || S.view !== "cam") { if (st) st.getTracks().forEach(function (t) { t.stop(); }); return; }
    if (st) { S.stream = st; d.vid.srcObject = st; var p = d.vid.play(); if (p && p.catch) p.catch(function () {}); }
  }

  /* ---------- render loop ---------- */
  function paintFallback(c, t) {
    var g = c.createLinearGradient(0, 0, 360, 640); g.addColorStop(0, "hsl(" + (t * 20 % 360) + ",60%,35%)"); g.addColorStop(1, "hsl(" + ((t * 20 + 120) % 360) + ",60%,18%)");
    c.fillStyle = g; c.fillRect(0, 0, 360, 640); c.font = "64px serif"; c.textAlign = "center"; c.fillText("\uD83D\uDCF7", 180, 320); c.font = "700 20px system-ui,sans-serif"; c.fillStyle = "rgba(255,255,255,.8)"; c.fillText("camera off", 180, 370);
  }
  var lastT = 0;
  function loop(ts) {
    if (!S) return;
    S.raf = requestAnimationFrame(loop);
    if (S.view !== "cam") return;
    var now = ts / 1000, dt = Math.min(.1, now - (lastT || now)); lastT = now;
    var d = S.d, c = d.ctx, vid = d.vid, ready = S.stream && vid.readyState >= 2 && vid.videoWidth > 0, src, sw, sh, flip = false;
    if (ready) { src = vid; sw = vid.videoWidth; sh = vid.videoHeight; flip = S.facing === "user"; } else { paintFallback(d.fbx, now); src = d.fb; sw = 360; sh = 640; }
    var ok = rend && rend.ok && rend.draw(src, sw, sh, flip, now, S.fx);
    if (ok) c.drawImage(rend.glc, 0, 0);
    else {
      c.save(); if ("filter" in c) c.filter = cssFilter(S.sel);
      if (flip) { c.translate(W, 0); c.scale(-1, 1); } drawCover(c, src, sw, sh, 1, 1); c.restore();
    }
    if (S.fx.stickers.length || S.parts.list.length) { S.parts.update(dt, S.fx.stickers); S.parts.draw(c); }
    if (S.game) { S.game.update(dt); S.game.draw(c); }
    if (S.recording) {
      var el_ = (performance.now() - S.recStart) / 1000, max = S.mode === "v60" ? 60 : 15;
      d.shutter.style.setProperty("--p", clamp(el_ / max * 100, 0, 100)); d.pill.textContent = "\u25CF " + fmtT(el_) + " / " + fmtT(max);
      if (el_ >= max) stopRec();
    }
  }

  /* ---------- shutter / recording ---------- */
  function onShutter() {
    if (S.view !== "cam" || S.countdown) return;
    if (S.recording) { stopRec(); return; }
    if (S.mode === "photo" && S.photos.length >= 10) { toast("That's 10 photos, hit Next"); return; }
    if (S.timer) countdown(S.timer, go); else go();
    function go() { if (S.mode === "photo") capture(); else startRec(); }
  }
  function countdown(n, cb) {
    var d = S.d; S.countdown = true; d.count.hidden = false;
    (function tick() { if (!S || S.view !== "cam") return; if (n <= 0) { d.count.hidden = true; S.countdown = false; cb(); return; } d.count.textContent = n; n--; S.cdT = setTimeout(tick, 1000); })();
  }
  function capture() {
    var d = S.d; d.flash.classList.remove("go"); void d.flash.offsetWidth; d.flash.classList.add("go");
    d.canvas.toBlob(function (b) { if (!b || !S) return; S.photos.push({ blob: b, url: URL.createObjectURL(b) }); renderStrip(); }, "image/jpeg", .92);
  }
  function renderStrip() {
    var d = S.d, n = S.photos.length; d.strip.textContent = ""; d.strip.hidden = !(S.mode === "photo" && n);
    if (S.mode !== "photo") return;
    S.photos.slice(-6).forEach(function (p) { var im = el("img"); im.src = p.url; d.strip.appendChild(im); });
    if (n) { var nx = el("button", "vs-next"); nx.textContent = "Next (" + n + ")"; nx.addEventListener("click", function () { showReview("photos"); }); d.strip.appendChild(nx); }
  }
  function startRec() {
    if (!window.MediaRecorder || !S.d.canvas.captureStream) { toast("Recording isn't supported in this browser"); return; }
    var d = S.d, out = d.canvas.captureStream(30), at = S.stream && S.stream.getAudioTracks()[0];
    if (at && at.readyState === "live") out.addTrack(at);
    var rec; try { rec = new MediaRecorder(out, S.mime ? { mimeType: S.mime, videoBitsPerSecond: 3000000, audioBitsPerSecond: 128000 } : undefined); } catch (e) { toast("Could not start recording"); return; }
    S.chunks = []; S.rec = rec;
    rec.ondataavailable = function (e) { if (e.data && e.data.size) S.chunks.push(e.data); };
    rec.onstop = function () {
      if (!S) return; S.recording = false; var dur = (performance.now() - S.recStart) / 1000;
      d.shutter.classList.remove("rec"); d.shutter.style.setProperty("--p", 0); d.modes.hidden = false; renderActive();
      if (S.discardRec) { S.discardRec = false; return; }
      if (dur < .8 || !S.chunks.length) { toast("Too short, hold on a little longer"); return; }
      S.vBlob = new Blob(S.chunks, { type: baseType(S.mime) }); S.dur = dur; showReview("video");
    };
    S.recStart = performance.now(); S.recording = true; d.shutter.classList.add("rec"); d.modes.hidden = true;
    rec.start(500);
  }
  function stopRec() { if (S && S.rec && S.recording && S.rec.state !== "inactive") { try { S.rec.stop(); } catch (e) {} } }

  /* ---------- review ---------- */
  function showReview(kind) {
    var d = S.d; S.view = "rev"; S.kind = kind; S.cur = 0; stopCamera(); clearTimeout(S.cdT); S.countdown = false;
    d.cam.hidden = true; d.canvas.hidden = true;
    var rv = d.rev = el("div", "vs-rev"), stage = el("div", "vs-stage"); rv.appendChild(stage);
    var top = el("div", "vs-rtop"), back = el("button", "vs-round"); back.innerHTML = "\u2190"; back.setAttribute("aria-label", "Back");
    var song = el("button", "vs-song"); top.appendChild(back); top.appendChild(song); top.appendChild(el("div", "vs-ghost")); rv.appendChild(top); d.song = song;
    var bot = el("div", "vs-rbot"), btns = el("div", "vs-rbtns"), next = el("button", "main"), discard = el("button"); discard.textContent = kind === "video" ? "Retake" : "Add more";
    btns.appendChild(discard); btns.appendChild(next); d.next = next;
    if (kind === "video") {
      S.url = URL.createObjectURL(S.vBlob);
      var v = d.pv = document.createElement("video"); v.src = S.url; v.loop = true; v.playsInline = true; v.autoplay = true; v.volume = S.origVol; stage.appendChild(v);
      var p = v.play(); if (p && p.catch) p.catch(function () { v.muted = true; v.play().catch(function () {}); });
      var lastCT = 0; v.addEventListener("timeupdate", function () { if (v.currentTime < lastCT - .3 && S.music) playBuf(S.music.buf, S.musicVol); lastCT = v.currentTime; });
    } else {
      var im = d.big = el("img", "vs-big"); im.src = S.photos[0].url; stage.appendChild(im);
      var th = d.thumbs = el("div", "vs-thumbs"); bot.appendChild(th);
      d.hint = el("div", "vs-hint"); bot.appendChild(d.hint);
      S.slideT = setInterval(function () { if (S.music && S.photos.length > 1) { S.cur = (S.cur + 1) % S.photos.length; d.big.src = S.photos[S.cur].url; renderThumbs(); } }, 2600);
      renderThumbs();
    }
    bot.appendChild(btns); rv.appendChild(bot); d.frame.appendChild(rv);
    back.addEventListener("click", backToCam); discard.addEventListener("click", backToCam);
    song.addEventListener("click", openMusic); next.addEventListener("click", finish);
    updateReviewUI();
  }
  function renderThumbs() {
    var d = S.d; if (!d.thumbs) return; d.thumbs.textContent = "";
    S.photos.forEach(function (p, i) {
      var w = el("div"), im = el("img", i === S.cur ? "on" : ""), x = el("button"); im.src = p.url; x.textContent = "\u2715";
      im.addEventListener("click", function () { S.cur = i; d.big.src = p.url; renderThumbs(); });
      x.addEventListener("click", function () { if (S.photos.length === 1) { backToCam(); S.photos = []; renderStrip(); return; } URL.revokeObjectURL(p.url); S.photos.splice(i, 1); S.cur = 0; d.big.src = S.photos[0].url; renderThumbs(); updateReviewUI(); });
      w.appendChild(im); if (S.photos.length > 1) w.appendChild(x); d.thumbs.appendChild(w);
    });
  }
  function updateReviewUI() {
    var d = S.d, m = S.music;
    d.song.innerHTML = "<b>\uD83C\uDFB5</b><span></span>"; d.song.lastChild.textContent = m ? m.name : "Add sound";
    d.next.textContent = S.kind === "photos" && m ? "Make video" : "Next";
    if (d.hint) d.hint.textContent = m ? "Your photos will become a video slideshow with " + m.name : "Add a song to turn these into a video slideshow, or hit Next to post as photos";
  }
  function backToCam() {
    var d = S.d; stopBuf(); clearInterval(S.slideT);
    if (S.kind === "video" && S.url) { URL.revokeObjectURL(S.url); S.url = null; S.vBlob = null; }
    if (d.rev) { d.rev.remove(); d.rev = null; } if (d.sheet) { d.sheet.remove(); d.sheet = null; }
    d.pv = d.big = d.thumbs = d.hint = null; d.cam.hidden = false; d.canvas.hidden = false; S.view = "cam"; renderStrip(); renderActive(); startCamera();
  }

  /* ---------- music sheet ---------- */
  function openMusic() {
    var d = S.d; if (d.sheet) return; actx();
    var sh = d.sheet = el("div", "vs-sheet");
    sh.innerHTML = '<div class="vs-sh"><h3>Add sound</h3><button class="vs-round" data-a="x" aria-label="Done">\u2715</button></div>' +
      '<div class="vs-vol"><span>\uD83C\uDFB5 Music</span><input type="range" min="0" max="100" value="' + Math.round(S.musicVol * 100) + '" data-v="m"></div>' +
      (S.kind === "video" ? '<div class="vs-vol"><span>\uD83C\uDFA4 Original sound</span><input type="range" min="0" max="100" value="' + Math.round(S.origVol * 100) + '" data-v="o"></div>' : "") +
      '<button class="vs-own" data-a="own">\uD83D\uDCC1 Use my own audio file</button><input type="file" accept="audio/*" hidden data-r="file"><div class="vs-list" data-r="list"></div>';
    d.frame.appendChild(sh);
    var list = sh.querySelector('[data-r="list"]'), file = sh.querySelector('[data-r="file"]');
    S.tracks = {};
    function row(id, icon, name, sub) { var b = el("button", "vs-track"); b.innerHTML = '<span class="tic"></span><span><b></b><small></small></span><span class="st"></span>'; b.querySelector(".tic").textContent = icon; b.querySelector("b").textContent = name; b.querySelector("small").textContent = sub; list.appendChild(b); S.tracks[id] = b; return b; }
    var none = row("none", "\uD83D\uDEAB", "No sound", "Keep the original audio only"); none.addEventListener("click", function () { S.music = null; stopBuf(); markTracks(); updateReviewUI(); });
    R.Music.TRACKS.forEach(function (t) { var b = row(t.id, t.icon, t.name, t.g + " \u00B7 " + t.bpm + " bpm"); b.addEventListener("click", function () { pickTrack(t, b); }); });
    markTracks();
    sh.addEventListener("click", function (e) { var a = e.target.closest("[data-a]"); if (!a) return; if (a.dataset.a === "x") closeMusic(); else if (a.dataset.a === "own") file.click(); });
    sh.addEventListener("input", function (e) {
      var v = e.target.dataset && e.target.dataset.v; if (!v) return; var val = e.target.value / 100;
      if (v === "m") { S.musicVol = val; if (AP.gain) AP.gain.gain.value = val; } else { S.origVol = val; if (d.pv) d.pv.volume = val; }
    });
    file.addEventListener("change", async function () {
      var f = file.files && file.files[0]; file.value = ""; if (!f) return;
      if (f.size > 25 * 1024 * 1024) { toast("Pick an audio file under 25 MB"); return; }
      var tok = ++S.pickTok; setSt("none", "");
      try { var buf = await decode(await f.arrayBuffer()); if (!S || tok !== S.pickTok) return; applyMusic({ id: "own", name: f.name.replace(/\.[^.]+$/, "").slice(0, 28) || "My audio", buf: buf }); }
      catch (err) { toast("Couldn't read that audio file"); }
    });
  }
  function setSt(id, txt) { Object.keys(S.tracks || {}).forEach(function (k) { var s = S.tracks[k].querySelector(".st"); if (s) s.textContent = k === id ? txt : s.textContent; }); }
  function markTracks() {
    Object.keys(S.tracks || {}).forEach(function (k) {
      var on = (S.music ? S.music.id === k : k === "none"); S.tracks[k].classList.toggle("on", on); S.tracks[k].querySelector(".st").textContent = on ? (k === "none" ? "" : "\u25B6 playing") : "";
    });
    if (S.music && S.music.id === "own") { var own = S.d.sheet && S.d.sheet.querySelector(".vs-own"); if (own) own.textContent = "\uD83D\uDCC1 " + S.music.name + " (tap to change)"; }
  }
  function applyMusic(m) {
    if (!S.musicTouched) { S.musicTouched = true; if (S.kind === "video") { S.origVol = .5; var s = S.d.sheet && S.d.sheet.querySelector('[data-v="o"]'); if (s) s.value = 50; if (S.d.pv) S.d.pv.volume = .5; } }
    S.music = m; if (S.d.pv) { try { S.d.pv.currentTime = 0; } catch (e) {} } playBuf(m.buf, S.musicVol); markTracks(); updateReviewUI();
  }
  async function pickTrack(t, btn) {
    actx(); var tok = ++S.pickTok, st = btn.querySelector(".st"); st.textContent = "loading...";
    try { var buf = await R.Music.render(t.id); if (!S || tok !== S.pickTok) return; applyMusic({ id: t.id, name: t.name, buf: buf }); }
    catch (e) { st.textContent = ""; toast("Couldn't load that track"); }
  }
  function closeMusic() { var d = S.d; if (d.sheet) { d.sheet.remove(); d.sheet = null; } }

  /* ---------- baking music into video / slideshow ---------- */
  function busy(msg, pct, cancelable) {
    var d = S.d; if (!d.busy) {
      var b = d.busy = el("div", "vs-busy"); b.innerHTML = '<div style="font-size:42px">\uD83C\uDFB6</div><div data-r="m" style="font-weight:800;font-size:1.1rem"></div><div class="bar"><i></i></div><div data-r="s" style="font-size:.8rem;opacity:.7">Keep this tab open, it renders in real time</div>';
      if (cancelable) { var c = el("button"); c.textContent = "Cancel"; c.addEventListener("click", function () { S.cancelled = true; }); b.appendChild(c); }
      d.frame.appendChild(b);
    }
    d.busy.querySelector('[data-r="m"]').textContent = msg; d.busy.querySelector(".bar i").style.width = Math.round(pct * 100) + "%";
  }
  function recordComposite(o) {
    return new Promise(function (resolve, reject) {
      var a = actx(), dest = a.createMediaStreamDestination(), cv = document.createElement("canvas"), c = cv.getContext("2d"), chunks = [], stopped = false, raf, t0, ms, rec;
      cv.width = W; cv.height = H;
      if (o.video) { var vs = a.createMediaElementSource(o.video.el), vg = a.createGain(); vg.gain.value = o.video.vol; vs.connect(vg); vg.connect(dest); }
      ms = a.createBufferSource(); ms.buffer = o.music.buf; ms.loop = true; var mg = a.createGain(); mg.gain.value = o.music.vol; ms.connect(mg); mg.connect(dest);
      var out = cv.captureStream(30); dest.stream.getAudioTracks().forEach(function (t) { out.addTrack(t); });
      try { rec = new MediaRecorder(out, S.mime ? { mimeType: S.mime, videoBitsPerSecond: 3000000, audioBitsPerSecond: 128000 } : undefined); } catch (e) { return reject(e); }
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () { cancelAnimationFrame(raf); try { ms.stop(); } catch (e) {} if (o.cleanup) o.cleanup(); if (S && S.cancelled) return reject(new Error("cancelled")); resolve(new Blob(chunks, { type: baseType(S.mime) })); };
      rec.onerror = function (e) { reject(e.error || new Error("record failed")); };
      function tick() {
        if (stopped) return; var t = (performance.now() - t0) / 1000; o.draw(c, t); busy("Adding your song... " + Math.min(99, Math.round(t / o.dur * 100)) + "%", Math.min(1, t / o.dur), true);
        if (t >= o.dur || (S && S.cancelled)) { stopped = true; try { rec.stop(); } catch (e) {} return; } raf = requestAnimationFrame(tick);
      }
      rec.start(500); t0 = performance.now(); ms.start();
      if (o.video) { try { o.video.el.currentTime = 0; } catch (e) {} var p = o.video.el.play(); if (p && p.catch) p.catch(function () {}); }
      tick();
    });
  }
  async function bakeVideo() {
    var v = document.createElement("video"); v.src = S.url; v.playsInline = true; v.preload = "auto"; v.style.cssText = "position:fixed;width:2px;height:2px;opacity:0;pointer-events:none"; document.body.appendChild(v);
    await new Promise(function (r) { v.onloadeddata = r; v.onerror = r; setTimeout(r, 4000); });
    return recordComposite({ dur: S.dur || (isFinite(v.duration) ? v.duration : 10), video: { el: v, vol: S.origVol }, music: { buf: S.music.buf, vol: S.musicVol },
      draw: function (c) { c.fillStyle = "#000"; c.fillRect(0, 0, W, H); drawCover(c, v, v.videoWidth, v.videoHeight, 1, 1); }, cleanup: function () { v.pause(); v.remove(); } });
  }
  function loadImg(u) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = u; }); }
  async function bakeSlides() {
    var imgs = await Promise.all(S.photos.map(function (p) { return loadImg(p.url); })), n = imgs.length, per = n === 1 ? 8 : 3, fade = .6;
    return recordComposite({ dur: n * per, music: { buf: S.music.buf, vol: S.musicVol },
      draw: function (c, t) {
        c.fillStyle = "#000"; c.fillRect(0, 0, W, H); var i = Math.min(n - 1, Math.floor(t / per)), lt = t - i * per;
        drawCover(c, imgs[i], imgs[i].width, imgs[i].height, 1 + .08 * (lt / per), 1);
        if (i < n - 1 && lt > per - fade) drawCover(c, imgs[i + 1], imgs[i + 1].width, imgs[i + 1].height, 1, (lt - (per - fade)) / fade);
      } });
  }

  async function finish() {
    if (S.busy) return; actx();
    var files = [], ts = Date.now();
    try {
      if (S.music && !window.MediaRecorder) { toast("This browser can't add music, posting without it"); S.music = null; }
      if (S.kind === "video") {
        if (!S.music) files = [new File([S.vBlob], "vibin-" + ts + "." + extOf(S.mime), { type: baseType(S.mime) })];
        else { S.busy = true; S.cancelled = false; stopBuf(); if (S.d.pv) S.d.pv.pause(); busy("Adding your song... 0%", 0, true); var b = await bakeVideo(); files = [new File([b], "vibin-" + ts + "." + extOf(S.mime), { type: baseType(S.mime) })]; }
      } else {
        if (!S.music) files = S.photos.map(function (p, i) { return new File([p.blob], "vibin-" + ts + "-" + i + ".jpg", { type: "image/jpeg" }); });
        else { S.busy = true; S.cancelled = false; stopBuf(); busy("Building your slideshow... 0%", 0, true); var sb = await bakeSlides(); files = [new File([sb], "vibin-" + ts + "." + extOf(S.mime), { type: baseType(S.mime) })]; }
      }
    } catch (e) {
      if (!S) return; S.busy = false; if (S.d.busy) { S.d.busy.remove(); S.d.busy = null; }
      if (!(e && e.message === "cancelled")) toast("Couldn't add the song, try another or post without it");
      if (S.music) playBuf(S.music.buf, S.musicVol); if (S.d.pv) S.d.pv.play().catch(function () {}); return;
    }
    var done = S.opts.onDone; close(); if (done) done(files);
  }

  /* ---------- close ---------- */
  function close() {
    if (!S) return; var s = S; S = null;
    document.removeEventListener("keydown", onKey); cancelAnimationFrame(s.raf); clearTimeout(s.cdT); clearInterval(s.slideT);
    s.discardRec = true; try { if (s.rec && s.rec.state !== "inactive") s.rec.stop(); } catch (e) {}
    if (s.stream) s.stream.getTracks().forEach(function (t) { t.stop(); });
    stopBuf(); if (s.url) URL.revokeObjectURL(s.url);
    /* photo urls stay valid until the page reloads so handed-off Files stay safe; blobs are independent of urls */
    s.photos.forEach(function (p) { URL.revokeObjectURL(p.url); });
    s.d.root.remove();
  }

  window.VibinStudio = { open: open, close: close, count: FX.length };
})();
