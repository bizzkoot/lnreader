window.readerSearch = new (function () {
  const MIN_QUERY_LENGTH = 3;
  const SEGMENT_BATCH_SIZE = 80;
  const MAX_RENDERED_MATCHES = 1500;
  const SPECIAL_CHARACTER_REGEX = /[^\p{L}\p{N}\s]/u;
  const INLINE_TEXT_ELEMENTS = new Set([
    'A',
    'ABBR',
    'B',
    'BDI',
    'BDO',
    'CITE',
    'CODE',
    'DATA',
    'DFN',
    'EM',
    'I',
    'KBD',
    'MARK',
    'Q',
    'RP',
    'RT',
    'RUBY',
    'S',
    'SAMP',
    'SMALL',
    'SPAN',
    'STRONG',
    'SUB',
    'SUP',
    'TIME',
    'U',
    'VAR',
    'WBR',
  ]);

  this.query = '';
  this.index = -1;
  this.matches = [];
  this.matchPositions = [];
  this.total = 0;
  this.isTruncated = false;
  this.searchToken = 0;
  this.pendingSearchTimer = null;

  this.emit = (query = this.query) => {
    reader.post({
      type: 'search-result',
      data: {
        query,
        current: this.index >= 0 ? this.index + 1 : 0,
        total: this.total,
        renderedTotal: this.matches.length,
        isTruncated: this.isTruncated,
      },
    });
  };

  this.cancelPendingSearch = () => {
    this.searchToken += 1;

    if (this.pendingSearchTimer !== null) {
      clearTimeout(this.pendingSearchTimer);
      this.pendingSearchTimer = null;
    }
  };

  this.refreshLayout = () => {
    reader.refresh();

    if (!reader.generalSettings.val.pageReader || !window.pageReader) {
      return;
    }

    const totalPages = parseInt(
      (reader.chapterWidth + reader.readerSettings.val.padding * 2) /
        reader.layoutWidth,
      10,
    );

    if (!Number.isFinite(totalPages) || totalPages <= 0) {
      return;
    }

    pageReader.totalPages.val = totalPages;

    if (pageReader.page.val >= totalPages) {
      pageReader.movePage(totalPages - 1);
    }
  };

  this.resetMatches = () => {
    const touchedParents = new Set();

    document.querySelectorAll('mark.lnreader-search-match').forEach(mark => {
      const parent = mark.parentNode;
      if (!parent) {
        return;
      }

      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      touchedParents.add(parent);
    });

    touchedParents.forEach(parent => {
      parent.normalize();
    });

    this.matches = [];
    this.matchPositions = [];
    this.index = -1;
    this.total = 0;
    this.isTruncated = false;
    this.refreshLayout();
  };

  this.clear = (emit = true, resetQuery = true) => {
    this.cancelPendingSearch();

    if (resetQuery) {
      this.query = '';
    }

    this.resetMatches();

    if (emit) {
      this.emit();
    }
  };

  this.getTextBlock = node => {
    let element = node.parentElement;

    while (
      element &&
      element !== reader.chapterElement &&
      INLINE_TEXT_ELEMENTS.has(element.nodeName)
    ) {
      element = element.parentElement;
    }

    return element || reader.chapterElement;
  };

  this.hasElementBetween = (previousNode, nextNode, selector) => {
    // Bounded DOM walk without cloneContents to avoid synchronous subtree cloning.
    const selectors = selector.split(',').map(s => s.trim().toLowerCase());
    const matchesSelector = el => {
      const name = (el.nodeName || '').toLowerCase();
      return selectors.some(sel => sel === name);
    };
    let node = previousNode;
    let steps = 0;
    const maxSteps = 400;
    while (node && node !== nextNode && steps < maxSteps) {
      if (node.nextSibling) {
        node = node.nextSibling;
      } else {
        let p = node.parentNode;
        while (p && p !== reader.chapterElement && !p.nextSibling) {
          p = p.parentNode;
        }
        node = p ? p.nextSibling : null;
      }
      if (!node || node === nextNode) break;
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (matchesSelector(node)) return true;
        // Check immediate children one level without deep clone
        let child = node.firstChild;
        let cSteps = 0;
        while (child && cSteps < 50) {
          if (child.nodeType === Node.ELEMENT_NODE && matchesSelector(child)) {
            return true;
          }
          child = child.nextSibling;
          cSteps += 1;
        }
      }
      steps += 1;
      // If we traversed up beyond common ancestor, compare document position
      if (
        node &&
        nextNode &&
        node.compareDocumentPosition &&
        node.compareDocumentPosition(nextNode) &
          Node.DOCUMENT_POSITION_FOLLOWING &&
        steps > 50
      ) {
        // still before nextNode, continue
      }
    }
    return false;
  };

  this.getTextSegments = () => {
    const segments = [];
    const textNodes = [];
    const walker = document.createTreeWalker(
      reader.chapterElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: node => {
          if (!node.nodeValue) {
            return NodeFilter.FILTER_REJECT;
          }
          if (node.parentElement?.closest('script, style')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    let node = walker.nextNode();

    while (node) {
      textNodes.push(node);
      node = walker.nextNode();
    }

    textNodes.forEach(textNode => {
      const block = this.getTextBlock(textNode);
      const previousSegment = segments[segments.length - 1];
      const previousEntry =
        previousSegment?.entries[previousSegment.entries.length - 1];
      const startsNewSegment =
        !previousSegment ||
        previousSegment.block !== block ||
        this.hasElementBetween(
          previousEntry.node,
          textNode,
          'br, hr, img, table, ul, ol',
        );

      if (startsNewSegment) {
        segments.push({
          block,
          entries: [],
          text: '',
        });
      }

      const segment = segments[segments.length - 1];
      const start = segment.text.length;
      const text = textNode.nodeValue || '';

      segment.entries.push({
        end: start + text.length,
        node: textNode,
        start,
      });
      segment.text += text;
    });

    return segments.filter(segment => segment.text.trim());
  };

  this.findSegmentMatches = (segment, normalizedTerm) => {
    const matches = [];
    const normalizedText = segment.text.toLowerCase();
    let matchIndex = normalizedText.indexOf(normalizedTerm);

    while (matchIndex !== -1) {
      matches.push(matchIndex);
      matchIndex = normalizedText.indexOf(
        normalizedTerm,
        matchIndex + normalizedTerm.length,
      );
    }

    return matches;
  };

  this.getTextPosition = (segment, offset, preferPrevious = false) => {
    for (const entry of segment.entries) {
      if (offset >= entry.start && offset < entry.end) {
        return {
          node: entry.node,
          offset: offset - entry.start,
        };
      }

      if (preferPrevious && offset === entry.end) {
        return {
          node: entry.node,
          offset: entry.node.nodeValue?.length || 0,
        };
      }
    }

    const entry = segment.entries[segment.entries.length - 1];
    return {
      node: entry.node,
      offset: entry.node.nodeValue?.length || 0,
    };
  };

  this.wrapSegmentMatch = (segment, start, length) => {
    const end = start + length;
    // Per-text-node wrapping to preserve DOM hierarchy (no cross-tag transplant).
    // Reverse order keeps offsets stable for earlier matches in same segment.
    let lastMark = null;
    for (let i = segment.entries.length - 1; i >= 0; i -= 1) {
      const entry = segment.entries[i];
      if (entry.end <= start || entry.start >= end) continue;
      const overlapStart = Math.max(start, entry.start);
      const overlapEnd = Math.min(end, entry.end);
      const localStart = overlapStart - entry.start;
      const localEnd = overlapEnd - entry.start;
      const node = entry.node;
      const textLen = (node.nodeValue || '').length;
      if (localStart < 0 || localEnd > textLen || localStart >= localEnd) {
        continue;
      }
      // Split to isolate match text: [before][match][after]
      let matchNode = node;
      if (localEnd < textLen) {
        matchNode.splitText(localEnd);
      }
      if (localStart > 0) {
        matchNode = matchNode.splitText(localStart);
      }
      const mark = document.createElement('mark');
      mark.className = 'lnreader-search-match';
      mark.textContent = matchNode.nodeValue;
      if (matchNode.parentNode) {
        matchNode.parentNode.replaceChild(mark, matchNode);
        lastMark = mark;
      }
    }
    return lastMark;
  };

  this.wrapSinglePosition = pos => {
    // Lazily render a single virtual match (beyond MAX_RENDERED_MATCHES)
    if (pos.mark && reader.chapterElement.contains(pos.mark)) {
      return pos.mark;
    }
    const segment = pos.segment;
    const start = pos.offset;
    const length = pos.length;
    pos.mark = this.wrapSegmentMatch(segment, start, length);
    // Refresh matches list from DOM and return the newly created mark
    const all = Array.from(
      reader.chapterElement.querySelectorAll('mark.lnreader-search-match'),
    );
    this.matches = all;
    // Find mark that corresponds to pos (last created for that segment range)
    // Return last match if we cannot pinpoint
    return all[all.length - 1] || null;
  };

  this.hasLiveMatches = () => {
    return (
      this.matches.length > 0 &&
      this.matches.every(match => reader.chapterElement.contains(match))
    );
  };

  this.ensureSearch = query => {
    const term = String(query ?? this.query ?? '').trim();
    if (!term) {
      this.clear();
      return false;
    }

    if (term !== this.query || !this.hasLiveMatches()) {
      this.search(term, Math.max(0, this.index));
    }

    return this.matches.length > 0;
  };

  this.scrollToMatch = match => {
    if (reader.generalSettings.val.pageReader && window.pageReader) {
      const rect = match.getBoundingClientRect();
      const relativePage = Math.floor(
        (rect.left + rect.width / 2) / reader.layoutWidth,
      );
      const page = Math.max(
        0,
        Math.min(
          pageReader.totalPages.val - 1,
          pageReader.page.val + relativePage,
        ),
      );
      pageReader.movePage(page);
      return;
    }

    match.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  this.focus = index => {
    if (!this.total) {
      this.index = -1;
      this.emit();
      return;
    }
    const totalForNav = this.total || this.matches.length;
    // Clear previous active
    if (this.index >= 0 && this.index < this.matches.length) {
      this.matches[this.index]?.classList.remove(
        'lnreader-search-match-active',
      );
    } else if (this.matchPositions[this.index]) {
      // Virtual active was a lazily created mark, clear by index fallback
      this.matches.forEach(m =>
        m.classList.remove('lnreader-search-match-active'),
      );
    }
    const logical = ((index % totalForNav) + totalForNav) % totalForNav;
    this.index = logical;
    // If beyond rendered, lazily render that match
    if (logical >= this.matches.length && logical < this.total) {
      const pos = this.matchPositions[logical];
      if (pos) {
        this.wrapSinglePosition(pos);
        // If wrap produced a mark, logical now points to last inserted; find its index
        // Re-resolve logical to the actual mark position (last element)
        // But keep logical for emit counting; map highlight to the newly created mark
        const newIdx = this.matches.length - 1;
        // Ensure matchPositions length matches matches for future clears
        // Highlight the newly created mark
        const match = this.matches[newIdx];
        if (match) {
          match.classList.add('lnreader-search-match-active');
          this.scrollToMatch(match);
          this.emit();
          return;
        }
        // Fallback: scroll to segment block position
        try {
          const startPos = this.getTextPosition(pos.segment, pos.offset);
          const el = startPos.node.parentElement || pos.segment.block;
          if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        } catch {}
        this.emit();
        return;
      }
    }
    const match = this.matches[logical];
    if (!match) {
      this.emit();
      return;
    }
    match.classList.add('lnreader-search-match-active');
    this.scrollToMatch(match);
    this.emit();
  };

  this.finishSearch = (query, preferredIndex, total) => {
    this.pendingSearchTimer = null;
    this.matches = Array.from(
      reader.chapterElement.querySelectorAll('mark.lnreader-search-match'),
    );
    this.total = total;
    this.isTruncated = this.matches.length < this.total;
    this.refreshLayout();

    if (!this.total) {
      this.emit(query);
      return;
    }

    this.focus(Math.max(0, Math.min(preferredIndex, this.total - 1)));
  };

  this.search = (query, preferredIndex = 0) => {
    const term = String(query ?? '').trim();
    this.cancelPendingSearch();
    this.resetMatches();
    this.query = term;

    if (
      !term ||
      (term.length < MIN_QUERY_LENGTH && !SPECIAL_CHARACTER_REGEX.test(term))
    ) {
      this.emit(term);
      return;
    }

    const searchToken = this.searchToken;
    const normalizedTerm = term.toLowerCase();
    const textSegments = this.getTextSegments();
    let textSegmentIndex = 0;
    let totalMatchCount = 0;
    let renderedMatchCount = 0;

    const matchPositions = [];
    const processBatch = () => {
      if (searchToken !== this.searchToken || term !== this.query) {
        this.pendingSearchTimer = null;
        return;
      }

      const batchEnd = Math.min(
        textSegmentIndex + SEGMENT_BATCH_SIZE,
        textSegments.length,
      );

      while (textSegmentIndex < batchEnd) {
        const segment = textSegments[textSegmentIndex];
        const matches = this.findSegmentMatches(segment, normalizedTerm);
        matches.forEach(matchIndex => {
          matchPositions.push({
            segment,
            offset: matchIndex,
            length: normalizedTerm.length,
          });
        });
        const renderableMatches = matches.slice(
          0,
          Math.max(0, MAX_RENDERED_MATCHES - renderedMatchCount),
        );

        renderableMatches.reverse().forEach(matchIndex => {
          this.wrapSegmentMatch(segment, matchIndex, normalizedTerm.length);
        });

        renderedMatchCount += renderableMatches.length;
        totalMatchCount += matches.length;
        textSegmentIndex += 1;
      }

      if (textSegmentIndex < textSegments.length) {
        this.pendingSearchTimer = setTimeout(processBatch, 0);
        return;
      }

      this.matchPositions = matchPositions;
      this.finishSearch(term, preferredIndex, totalMatchCount);
    };

    processBatch();
  };

  this.next = query => {
    if (this.ensureSearch(query)) {
      this.focus(this.index + 1);
    }
  };

  this.previous = query => {
    if (this.ensureSearch(query)) {
      this.focus(this.index - 1);
    }
  };
})();
