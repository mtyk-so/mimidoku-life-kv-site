function syncDataToKV() {
  const props = PropertiesService.getScriptProperties();
  const workerUrl = props.getProperty("WORKER_URL");
  const secret = props.getProperty("CMS_IMPORT_SECRET");

  if (!workerUrl || !secret) {
    throw new Error("スクリプトプロパティ（WORKER_URL, CMS_IMPORT_SECRET）が未設定です。");
  }

  const tags = getTagsFromSheet();
  const items = getItemsFromSheet();

  // 空配列をKVに送ると公開中の作品が全部消えるため、その手前で止める。
  // シート読み込みが未実装のあいだ、このガードが誤操作の歯止めになる。
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("items が空です。KVを空で上書きしないよう中止しました。getItemsFromSheet() を実装してください。");
  }
  if (!Array.isArray(tags) || tags.length === 0) {
    throw new Error("tags が空です。KVを空で上書きしないよう中止しました。");
  }

  const payload = {
    files: {
      "tags.json": tags,
      "items.json": items
    }
  };

  const response = UrlFetchApp.fetch(workerUrl + "/import", {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-CMS-Secret": secret
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  Logger.log("Status: " + response.getResponseCode());
  Logger.log("Response: " + response.getContentText());
}

function getTagsFromSheet() {
  return [
    { "id": "all", "name": "すべて" },
    { "id": "business", "name": "ビジネス・仕事術" },
    { "id": "self-help", "name": "自己啓発・マインド" },
    { "id": "novel", "name": "小説・エンタメ" },
    { "id": "finance", "name": "お金・投資" },
    { "id": "liberal-arts", "name": "教養・サイエンス" }
  ];
}

// TODO: スプレッドシートから作品行を読む実装。
// 実装するまでは空を返すため、syncDataToKV() はガードで停止する。
function getItemsFromSheet() {
  return [];
}
