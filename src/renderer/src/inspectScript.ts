// Injected into a loaded <webview> page's own document (via
// executeJavaScript) to power "Inspect" mode. It only draws a hover
// highlight directly in the guest page and, on click, gathers everything
// about the picked element and reports it to the host via the narrow
// sendToHost bridge exposed by the guest preload (src/preload/guest.ts) —
// the actual details panel lives in the host UI so it can float above both
// compare layers, unclipped by the compare slider.
// Written without template literals/backticks so it can be embedded inside
// a TS template string without escaping.
export const INSPECT_ENABLE_SCRIPT = `
(function () {
  if (window.__pcInspector) { window.__pcInspector.enable(); return; }

  var active = true;

  var hilite = document.createElement('div');
  hilite.style.position = 'fixed';
  hilite.style.pointerEvents = 'none';
  hilite.style.zIndex = '2147483647';
  hilite.style.border = '1.5px solid #7c9cff';
  hilite.style.background = 'rgba(124,156,255,0.15)';
  hilite.style.borderRadius = '2px';
  hilite.style.display = 'none';
  hilite.style.boxSizing = 'border-box';
  document.documentElement.appendChild(hilite);

  function updateHighlight(el) {
    if (!el || el === document.documentElement || el === document.body) { hilite.style.display = 'none'; return; }
    var rect = el.getBoundingClientRect();
    hilite.style.display = 'block';
    hilite.style.left = rect.left + 'px';
    hilite.style.top = rect.top + 'px';
    hilite.style.width = rect.width + 'px';
    hilite.style.height = rect.height + 'px';
  }

  function shortDescribe(el) {
    if (!el || el.nodeType !== 1) return '';
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList && el.classList.length) s += '.' + Array.prototype.join.call(el.classList, '.');
    return s;
  }

  function declsOf(styleDecl) {
    var decls = [];
    for (var i = 0; i < styleDecl.length; i++) {
      var prop = styleDecl[i];
      decls.push([prop, styleDecl.getPropertyValue(prop)]);
    }
    return decls;
  }

  function getMatchedRules(el) {
    var results = [];
    if (el.style && el.style.length) {
      results.push({ selector: 'element.style', source: 'inline', decls: declsOf(el.style) });
    }
    var skippedSheets = 0;

    function collect(rules, source) {
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (rule.type === 1) { // CSSRule.STYLE_RULE
          try {
            if (el.matches(rule.selectorText)) {
              results.push({ selector: rule.selectorText, source: source, decls: declsOf(rule.style) });
            }
          } catch (e) { /* invalid/unsupported selector — skip */ }
        } else if (rule.type === 4) { // CSSRule.MEDIA_RULE
          try {
            if (window.matchMedia(rule.conditionText || rule.media.mediaText).matches) {
              collect(rule.cssRules, source + ' @media');
            }
          } catch (e) { /* ignore */ }
        } else if (rule.type === 12) { // CSSRule.SUPPORTS_RULE
          collect(rule.cssRules, source);
        }
      }
    }

    var sheets = document.styleSheets;
    for (var s = 0; s < sheets.length; s++) {
      var sheet = sheets[s];
      var rules;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        skippedSheets++;
        continue;
      }
      if (!rules) continue;
      collect(rules, sheet.href || 'inline <style>');
    }
    return { rules: results, skippedSheets: skippedSheets };
  }

  function getComputed(el) {
    var computed = window.getComputedStyle(el);
    var out = [];
    for (var i = 0; i < computed.length; i++) {
      var name = computed[i];
      var value = computed.getPropertyValue(name);
      if (!value) continue;
      out.push([name, value]);
    }
    return out;
  }

  // Only descends — the selected element and its subtree — never climbs
  // toward <html>, per how this is meant to be read: start at what you
  // clicked, drill inward.
  function serializeTree(el, depth) {
    var node = {
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.className && typeof el.className === 'string' ? el.className.trim() : '',
      childCount: el.children.length,
      children: []
    };
    if (depth >= 6) { node.truncated = true; return node; }
    var kids = el.children;
    var limit = Math.min(kids.length, 50);
    for (var i = 0; i < limit; i++) node.children.push(serializeTree(kids[i], depth + 1));
    if (kids.length > limit) node.moreChildren = kids.length - limit;
    return node;
  }

  function attributesOf(el) {
    var attrs = [];
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      if (attr.name === 'id' || attr.name === 'class') continue;
      attrs.push([attr.name, attr.value]);
    }
    return attrs;
  }

  function selectElement(el) {
    var rect = el.getBoundingClientRect();
    var matched = getMatchedRules(el);
    window.__pcHost.send('pc-inspect-select', {
      label: shortDescribe(el),
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      classes: el.className && typeof el.className === 'string' ? el.className.trim() : '',
      attributes: attributesOf(el),
      size: { width: Math.round(rect.width), height: Math.round(rect.height) },
      position: { x: Math.round(rect.left), y: Math.round(rect.top) },
      tree: serializeTree(el, 0),
      matchedRules: matched.rules,
      skippedStylesheets: matched.skippedSheets,
      computed: getComputed(el)
    });
  }

  function onMouseMove(e) {
    if (!active) return;
    updateHighlight(e.target);
  }

  function onClick(e) {
    if (!active) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    selectElement(e.target);
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);

  window.__pcInspector = {
    enable: function () { active = true; },
    disable: function () {
      active = false;
      hilite.style.display = 'none';
    },
    destroy: function () {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      hilite.remove();
      delete window.__pcInspector;
    }
  };
})();
`

export const INSPECT_DISABLE_SCRIPT = `
(function () {
  if (window.__pcInspector) window.__pcInspector.disable();
})();
`
