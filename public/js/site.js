// 全ページ共通のユーティリティ。config.js の後に読み込む。

// KV由来のテキストをそのままinnerHTMLに入れないためのエスケープ
function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

// http/https 以外のURL（javascript: など）を弾く。不正ならテキスト素材のURLに寄せる
function safeLink(url) {
  const fallback = (window.SiteConfig && window.SiteConfig.AUDIBLE_CAMPAIGN_URL) || "#";
  if (!url) return fallback;
  try {
    const parsed = new URL(url, location.href);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return url;
  } catch (e) {
    // パースできないURLはfallback
  }
  return fallback;
}

// このページで実際に表示した素材。計測ピクセルは表示した素材のぶんだけ出す。
const a8Shown = new Set();

// テキスト素材(001)のリンクを公式ボタンに適用する。
// 対象は #audible-campaign-btn と data-aff="audible" を付けた要素。
function applyAffiliateLinks() {
  const text = window.SiteConfig && window.SiteConfig.A8 && window.SiteConfig.A8.text;
  if (!text || !text.link) return;

  const targets = new Set();
  const legacy = document.getElementById("audible-campaign-btn");
  if (legacy) targets.add(legacy);
  document.querySelectorAll('a[data-aff="audible"]').forEach(el => targets.add(el));

  targets.forEach(el => {
    el.href = text.link;
    el.target = "_blank";
    el.rel = "sponsored nofollow noopener noreferrer";
  });

  if (targets.size > 0) a8Shown.add("text");
}

// 作品カードのボタンもテキスト素材のリンクなので、レンダー後に呼んで計測対象に含める
function markTextMaterialShown() {
  a8Shown.add("text");
}

// バナー素材(006)を data-a8-banner を付けた要素の中に描画する
function renderA8Banners() {
  const banner = window.SiteConfig && window.SiteConfig.A8 && window.SiteConfig.A8.banner;
  const slots = document.querySelectorAll("[data-a8-banner]");
  if (!banner || !banner.link || !banner.img || slots.length === 0) return;

  slots.forEach(slot => {
    const a = document.createElement("a");
    a.href = banner.link;
    a.target = "_blank";
    a.rel = "sponsored nofollow noopener noreferrer";

    const img = document.createElement("img");
    img.src = banner.img;
    img.width = banner.width;
    img.height = banner.height;
    img.alt = "";
    img.style.border = "0";
    // 遅延読み込みはしない。計測ピクセルだけ先に発火して
    // バナー本体が表示されない、というズレを避けるため。

    a.appendChild(img);
    slot.appendChild(a);
  });

  a8Shown.add("banner");
}

// A8.net の表示回数計測タグ（1x1画像）。
// 素材ごとにホストとa8matが違うため、表示した素材のぶんだけ出す。
function renderA8Impressions() {
  const a8 = window.SiteConfig && window.SiteConfig.A8;
  const slot = document.getElementById("a8-impression");
  if (!a8 || !slot) return;

  a8Shown.forEach(key => {
    const material = a8[key];
    if (!material || !material.impression) return;
    const img = new Image(1, 1);
    img.src = material.impression;
    img.alt = "";
    img.style.border = "0";
    slot.appendChild(img);
  });
}
