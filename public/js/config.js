// サイト全体の設定。ここ1箇所だけ直せば全ページに反映される。
window.SiteConfig = {
  SITE_NAME: "耳読ライフ | Audibleの登録・使い方・解約ガイド",

  // Cloudflare Worker（KVからデータを返すAPI）
  WORKER_BASE_URL: "https://mimidoku-life-kv-cms.mtyk-so.workers.dev",

  // ローカル(localhost/127.0.0.1)なら public/data/ の見本を、
  // それ以外（本番）ならWorker経由でKVを見る。手で切り替える必要はない。
  get USE_LOCAL_SAMPLE() {
    const h = location.hostname;
    return h === "localhost" || h === "127.0.0.1" || h === "";
  },

  // A8.net の広告素材。
  // 素材ごとに a8mat と計測ピクセルのホストが違うため、対で持たせる。
  // 素材を差し替えるときは link と impression を必ずセットで入れ替えること。
  A8: {
    // 素材ID:001 テキストリンク「オーディオブックAudible」
    text: {
      link: "https://px.a8.net/svt/ejp?a8mat=4BC2EL+2N9ECA+5TB0+5YJRM",
      impression: "https://www13.a8.net/0.gif?a8mat=4BC2EL+2N9ECA+5TB0+5YJRM"
    },
    // 素材ID:006 バナー 300×250「プレミアムプラン 30日間無料体験」
    banner: {
      link: "https://px.a8.net/svt/ejp?a8mat=4BC2EL+2N9ECA+5TB0+5ZMCH",
      img: "https://www22.a8.net/svt/bgt?aid=260903469160&wid=002&eno=01&mid=s00000027126001006000&mc=1",
      width: 300,
      height: 250,
      impression: "https://www16.a8.net/0.gif?a8mat=4BC2EL+2N9ECA+5TB0+5ZMCH"
    }
  },

  // 作品データにlinkが無いときの寄せ先（テキスト素材と同じ）
  get AUDIBLE_CAMPAIGN_URL() {
    return this.A8.text.link;
  }
};
