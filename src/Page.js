class Page {
  constructor(results, opts = {}) {
    this.length = results.length;

    this.data = results;
    this.opts = opts;
  }

  get pageSize() {
    return this.opts.pageSize || this.length;
  }

  get filteredSize() {
    return this.opts.filtered;
  }

  get totalSize() {
    return this.opts.total;
  }

  get prevPage() {
    return this.opts.previous;
  }

  get currentPage() {
    return this.opts.current;
  }

  get nextPage() {
    return this.opts.next;
  }
}

module.exports = Page;
