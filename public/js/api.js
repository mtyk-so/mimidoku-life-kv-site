const ApiService = {
  async fetchTags() {
    return this._fetchData("tags.json");
  },

  async fetchItems() {
    return this._fetchData("items.json");
  },

  async _fetchData(filename) {
    let url = "";
    if (window.SiteConfig.USE_LOCAL_SAMPLE) {
      url = `/data/${filename}`;
    } else {
      url = `${window.SiteConfig.WORKER_BASE_URL}/data/${filename}`;
    }

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load ${filename}: ${res.status}`);
    }
    return res.json();
  }
};
