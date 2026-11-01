(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SessionLibrary = factory();
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  class Store {
    constructor() { this.bookmarks = []; this.history = []; this.sequence = 0; }
    record(url, title = '') {
      try { if (!['http:', 'https:'].includes(new URL(url).protocol)) return null; } catch { return null; }
      return { id: String(++this.sequence), url, title: String(title || url), at: Date.now() };
    }
    bookmark(url, title) {
      const existing = this.bookmarks.find((item) => item.url === url);
      if (existing) return existing;
      const item = this.record(url, title);
      if (item) { this.bookmarks.push(item); if (this.bookmarks.length > 200) this.bookmarks.shift(); }
      return item;
    }
    visit(url, title) {
      const item = this.record(url, title);
      if (!item) return null;
      if (this.history[0]?.url === url) { Object.assign(this.history[0], { title: item.title, at: item.at }); return this.history[0]; }
      this.history.unshift(item);
      if (this.history.length > 300) this.history.pop();
      return item;
    }
    removeBookmark(id) { this.bookmarks = this.bookmarks.filter((item) => item.id !== id); }
    clearHistory() { this.history.length = 0; }
  }
  return { Store };
});
