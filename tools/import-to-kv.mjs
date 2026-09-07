// public/data/*.json を Worker の /import 経由で KV へ投入する。
//
//   node tools/import-to-kv.mjs
//
// シークレットは対話入力（画面に出ない・履歴にも残らない）。
// CI などで自動化したいときは環境変数 CMS_SECRET を先に立てておけば入力を省略する。
// 投入前に中身の要約を出して y/N を聞くので、取り違えたまま上書きすることはない。

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORKER = "https://mimidoku-life-kv-cms.mtyk-so.workers.dev";

function readJson(rel) {
  const p = path.join(ROOT, rel);
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`${rel} を読めない: ${e.message}`);
  }
}

function ask(query, { mask = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    if (mask) {
      // 入力中の文字を画面へ出さない。プロンプト自体は一度だけ出す。
      let shown = false;
      rl._writeToOutput = (str) => {
        if (!shown && str.includes(query)) {
          rl.output.write(query);
          shown = true;
        }
      };
    }
    rl.question(query, (value) => {
      rl.close();
      if (mask) process.stdout.write("\n");
      resolve(value);
    });
  });
}

const tags = readJson("public/data/tags.json");
const items = readJson("public/data/items.json");

// 空配列でKVを上書きすると公開中の作品が全部消える。GAS側と同じガード。
if (!Array.isArray(items) || items.length === 0) {
  console.error("items.json が空。中止した。");
  process.exit(1);
}
if (!Array.isArray(tags) || tags.length === 0) {
  console.error("tags.json が空。中止した。");
  process.exit(1);
}

const withImpression = items.filter((i) => i.impression && i.impression.trim()).length;
console.log(`投入先 : ${WORKER}/import`);
console.log(`items  : ${items.length}件（impression記入済み ${withImpression}件）`);
console.log(`tags   : ${tags.length}件`);
console.log("先頭の作品:", items[0].title);
console.log("  description:", String(items[0].description).slice(0, 60) + "…");
console.log("");

const ok = await ask("この内容でKVを上書きする？ [y/N]: ");
if (ok.trim().toLowerCase() !== "y") {
  console.log("中止した。");
  process.exit(0);
}

const secret = process.env.CMS_SECRET || (await ask("CMS_IMPORT_SECRET: ", { mask: true }));
if (!secret.trim()) {
  console.error("シークレットが空。中止した。");
  process.exit(1);
}

const res = await fetch(`${WORKER}/import`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-CMS-Secret": secret.trim(),
  },
  body: JSON.stringify({ files: { "tags.json": tags, "items.json": items } }),
});

const body = await res.text();
console.log(`\n${res.status} ${body}`);

if (res.status === 401) {
  console.error("→ シークレットが違う。2026-09-04の改名時に新Workerへ登録した値を使う。");
  process.exit(1);
}
if (!res.ok) process.exit(1);

console.log("→ 反映を確認するには:");
console.log(`   ${WORKER}/data/items.json`);
