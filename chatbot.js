/* Agentic chatbot for k7s3.github.io (v2)
 *
 * Runs 100% client-side: no backend, no API keys, no network calls in the
 * default mode. The agent keeps conversation memory (topic + entity context,
 * pronoun resolution), asks clarifying questions when intent is ambiguous,
 * runs multi-turn actions (project filter/refine, compare, email drafting),
 * and scores intents with a small client-side model (token overlap +
 * weighted phrases + context boost).
 *
 * Optional AI mode (off by default) answers questions through Google's
 * Gemini API using the site's embedded key (GEMINI_API_KEY below, which is
 * restricted to this site). The visitor's questions are sent to Google;
 * nothing else leaves the device.
 *
 * Tools: navigateTo | filterProjects | clearProjectFilter |
 *        downloadResume | composeEmail | answerFaq | compareEntities
 *
 * Knowledge lives in chatbot-data.js (chatbotKB) plus the site's data.js.
 */
(function () {
  'use strict';

  if (window.__k7Chatbot) return; // init once

  const KB = window.chatbotKB;
  const EMAIL = KB.profile.email;

  /* -------- site config: key for AI mode --------
   * AI mode is ON by default: every question goes to Google's Gemini API
   * using the key below. Create the key in Google AI Studio and restrict it
   * to this site's HTTP referrer (https://k7s3.github.io/*) before deploy.
   * While the placeholder is still in place, the fast built-in assistant
   * answers instead - nothing is sent to Google.
   */
  const GEMINI_API_KEY = "__GEMINI_API_KEY_PLACEHOLDER__";

  /* ---------------- utilities ---------------- */

  const $ = (sel, root) => (root || document).querySelector(sel);

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function norm(text) {
    return ' ' + String(text).toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[?.!,;:"()\[\]]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() + ' ';
  }

  // substring check on normalized text
  function has(t) {
    for (let i = 1; i < arguments.length; i++) {
      if (t.indexOf(arguments[i]) !== -1) return true;
    }
    return false;
  }

  // whole-word check on normalized text
  function word(t, w) {
    return t.indexOf(' ' + w + ' ') !== -1;
  }

  const STOP = new Set([
    'the', 'and', 'for', 'with', 'show', 'showed', 'please', 'about',
    'what', 'which', 'does', 'are', 'his', 'her', 'him', 'your', 'you',
    'can', 'could', 'would', 'like', 'want', 'get', 'got', 'has', 'have',
    'some', 'any', 'all', 'its', "it's", 'that', 'this', 'those', 'these',
    'from', 'into', 'over', 'under', 'between', 'me', 'more', 'tell',
    'only', 'just', 'ones', 'those', 'there', 'here', 'very', 'much',
    'than', 'then', 'them', 'they', 'out', 'also', 'well', 'know'
  ]);

  const PRONOUNS = new Set([
    'it', 'that', 'this', 'these', 'those', 'there', 'here',
    'his', 'him', 'he', 'her', 'she', 'they', 'them', 'its'
  ]);

  // Generic words that carry no topic by themselves ("show me his projects").
  const PROJECT_WORDS = new Set(['project', 'projects', 'portfolio', 'repos', 'repository', 'repo']);

  function tokens(t) {
    return t.split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1 && !STOP.has(w));
  }

  function hasPronoun(t) {
    return t.split(/[^a-z0-9]+/).some((w) => PRONOUNS.has(w));
  }

  /* ---------------- site data access ---------------- */

  function projects() {
    try {
      if (window.websiteData && window.websiteData.projects) return window.websiteData.projects;
      if (typeof websiteData !== 'undefined' && websiteData.projects) return websiteData.projects;
    } catch (e) { /* noop */ }
    return [];
  }

  function timeline() {
    try {
      if (window.websiteData && window.websiteData.timeline) return window.websiteData.timeline;
      if (typeof websiteData !== 'undefined' && websiteData.timeline) return websiteData.timeline;
    } catch (e) { /* noop */ }
    return [];
  }

  function publications() {
    try {
      if (window.websiteData && window.websiteData.publications) return window.websiteData.publications;
      if (typeof websiteData !== 'undefined' && websiteData.publications) return websiteData.publications;
    } catch (e) { /* noop */ }
    return [];
  }

  function projectKey(name) {
    return String(name || '').toLowerCase().replace(/[-_.\s]+/g, ' ').trim();
  }

  function allTags() {
    const set = {};
    Object.keys(KB.projectTags || {}).forEach((n) => {
      (KB.projectTags[n] || []).forEach((tg) => { set[tg] = true; });
    });
    return set;
  }

  /* ---------------- conversation memory ---------------- */

  const ctx = {
    history: [],        // [{user, intent}]
    lastTopic: null,    // faq id | 'projects' | 'compare' | 'email' | section key
    lastEntity: null,   // 'Meta' | 'Synergii' | 'project:Name' | null
    projectFilter: null,// {query, names:[], shown}
    pending: null       // {kind, step, data} for multi-step actions
  };

  function resetCtx() {
    ctx.history = [];
    ctx.lastTopic = null;
    ctx.lastEntity = null;
    ctx.projectFilter = null;
    ctx.pending = null;
  }

  // Which entity a faq answer is "about", for pronoun follow-ups.
  const FAQ_ENTITY = {
    work: 'Meta',
    entrepreneur: 'Synergii',
    research: 'CCNSB',
    education: 'Cornell Tech',
    location: null,
    skills: null,
    contact: null,
    who: null
  };

  const TOPIC_LABEL = {
    work: 'his work',
    entrepreneur: 'Synergii',
    research: 'his research',
    education: 'his education',
    skills: 'his skills',
    contact: 'contacting him',
    location: 'his location',
    who: 'who he is',
    projects: 'his projects',
    compare: 'comparisons',
    email: 'the email draft'
  };

  function remember(userText, intent, topic, entity) {
    ctx.history.push({ user: userText, intent: intent });
    if (ctx.history.length > 20) ctx.history.shift();
    if (topic) ctx.lastTopic = topic;
    if (entity !== undefined) ctx.lastEntity = entity;
  }

  /* ---------------- tools ---------------- */

  function highlightProjectCards(names) {
    const grid = $('#projects-container');
    if (!grid) return;
    const set = {};
    names.forEach((n) => { set[n] = true; });
    grid.classList.add('chat-filter-active');
    const cards = grid.querySelectorAll('.project-card');
    for (let i = 0; i < cards.length; i++) {
      cards[i].classList.toggle('chat-match', !!set[cards[i].dataset.projectName]);
    }
    if (!$('#chat-filter-pill') && names.length) {
      const pill = document.createElement('button');
      pill.id = 'chat-filter-pill';
      pill.className = 'chat-filter-pill';
      pill.innerHTML = '<i class="fas fa-times"></i> Clear highlight (' + names.length + ' shown)';
      pill.setAttribute('aria-label', 'Clear project highlight');
      pill.addEventListener('click', () => agent.handle('show all projects'));
      const section = $('#projects .container');
      const title = section && section.querySelector('.section-title');
      if (title) title.after(pill);
    }
  }

  // Score one project against query tokens. Tag hits are whole-word and only
  // count when the project actually carries the tag.
  function scoreProject(p, toks, tagWeights) {
    const pTags = KB.projectTags[p.name] || [];
    const tagStr = ' ' + pTags.join(' ') + ' ';
    const hayWords = ' ' + norm([p.name, p.description, p.language].filter(Boolean).join(' '))
      .split(/[^a-z0-9+#.]+/).filter(Boolean).join(' ') + ' ';
    let score = 0;
    toks.forEach((tok) => {
      if (tagStr.indexOf(' ' + tok + ' ') !== -1) score += 3 * (tagWeights[tok] || 1);
      else if (hayWords.indexOf(' ' + tok + ' ') !== -1) score += 1;
    });
    return score;
  }

  // Resolve friendly aliases ("machine learning" -> ml) inside a query.
  function resolveAliases(t) {
    const found = {};
    Object.keys(KB.tagAliases || {}).forEach((alias) => {
      if (t.indexOf(alias) !== -1) found[KB.tagAliases[alias]] = true;
    });
    return found;
  }

  const tools = {
    // Scroll to a site section. Returns the section id acted on.
    navigateTo(sectionId) {
      const el = document.getElementById(sectionId);
      if (!el) return { ok: false, sectionId: sectionId };
      const top = el.getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo({ top: top, behavior: 'smooth' });
      return { ok: true, sectionId: sectionId };
    },

    // Find projects matching topic tokens. scopeNames (optional) restricts
    // the search to a previous result set, enabling "only the X ones".
    filterProjects(rawQuery, scopeNames) {
      const t = norm(rawQuery);
      const aliasTags = resolveAliases(t);
      const toks = tokens(t).filter((w) => !PROJECT_WORDS.has(w));
      Object.keys(aliasTags).forEach((tg) => { if (toks.indexOf(tg) === -1) toks.push(tg); });

      let pool = projects();
      if (scopeNames && scopeNames.length) {
        const set = {};
        scopeNames.forEach((n) => { set[n] = true; });
        pool = pool.filter((p) => set[p.name]);
      }

      // No topic given ("projects", "show me his projects") -> show everything.
      if (!toks.length) {
        highlightProjectCards(pool.map((p) => p.name));
        return { ok: true, matches: pool, query: rawQuery.trim(), refined: !!scopeNames };
      }

      const tags = allTags();
      const tagWeights = {};
      toks.forEach((tok) => { if (tags[tok]) tagWeights[tok] = 1; });

      const scored = pool.map((p) => ({ project: p, score: scoreProject(p, toks, tagWeights) }))
        .filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);

      const matches = scored.map((r) => r.project);
      highlightProjectCards(matches.map((p) => p.name));
      return { ok: true, matches: matches, query: rawQuery.trim(), refined: !!scopeNames };
    },

    clearProjectFilter() {
      const grid = $('#projects-container');
      if (grid) {
        grid.classList.remove('chat-filter-active');
        const cards = grid.querySelectorAll('.project-card.chat-match');
        for (let i = 0; i < cards.length; i++) cards[i].classList.remove('chat-match');
      }
      const pill = $('#chat-filter-pill');
      if (pill) pill.remove();
      ctx.projectFilter = null;
      return { ok: true };
    },

    // Trigger the resume.pdf download via the existing hero link.
    downloadResume() {
      let a = document.querySelector('a[href="resume.pdf"]');
      if (!a) {
        a = document.createElement('a');
        a.href = 'resume.pdf';
        a.setAttribute('download', 'Keshavan_Seshadri_Resume.pdf');
        document.body.appendChild(a);
      }
      a.click();
      return { ok: true };
    },

    // Open a pre-addressed email draft in the visitor's mail client.
    composeEmail(subject, body) {
      const mailto =
        'mailto:' + EMAIL +
        '?subject=' + encodeURIComponent(subject || 'Hello Keshavan') +
        '&body=' + encodeURIComponent(body || 'Hi Keshavan,\n\n');
      const a = document.createElement('a');
      a.href = mailto;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => a.remove(), 1000);
      return { ok: true, mailto: mailto };
    },

    answerFaq(faqId) {
      const faq = KB.faqs.find((f) => f.id === faqId);
      return faq ? { ok: true, answer: faq.answer, faq: faq } : { ok: false };
    }
  };

  // Match project names mentioned in normalized text t.
  function matchProjectNames(t, toks) {
    const found = [];
    projects().forEach((p) => {
      const key = projectKey(p.name);
      if (!key) return;
      if (t.indexOf(' ' + key + ' ') !== -1) { found.push(p.name); return; }
      const parts = key.split(' ').filter((w) => w.length > 2);
      if (parts.length && parts.every((w) => toks.indexOf(w) !== -1)) found.push(p.name);
    });
    return found;
  }

  // Canonical org/school entities for compare + entity resolution.
  const ORG_ENTITIES = ['Meta', 'Prudential', 'Synergii', 'BrowserStack', 'CCNSB', 'Cornell Tech', 'IIIT Hyderabad'];

  function matchOrgEntities(t) {
    const found = [];
    ORG_ENTITIES.forEach((name) => {
      const key = projectKey(name);
      if (t.indexOf(' ' + key + ' ') !== -1) found.push(name);
    });
    return found;
  }

  // Build a structured description of one entity for comparison.
  function entityInfo(name) {
    const proj = projects().find((p) => projectKey(p.name) === projectKey(name));
    if (proj) {
      const tags = (KB.projectTags[proj.name] || []).join(', ');
      return {
        kind: 'project',
        title: proj.name,
        rows: [
          ['What it is', proj.description || 'Personal project'],
          ['Language', proj.language || 'n/a'],
          ['Topics', tags || 'n/a'],
          ['Link', proj.url ? '<a href="' + esc(proj.url) + '" target="_blank" rel="noopener">GitHub</a>' : 'n/a']
        ]
      };
    }
    const entry = timeline().find((e) => projectKey(e.title).indexOf(projectKey(name)) !== -1);
    if (entry) {
      return {
        kind: 'role',
        title: entry.title,
        rows: [
          ['Period', entry.date || 'n/a'],
          ['Details', entry.description || '']
        ]
      };
    }
    if (KB.entities[name]) {
      return { kind: 'fact', title: KB.entities[name].label, rows: [['Details', KB.entities[name].detail]] };
    }
    return null;
  }

  /* ---------------- intent understanding ----------------
   * Small client-side scoring model: token overlap + weighted phrases +
   * context boost. No keyword-equality matching; every candidate intent gets
   * a numeric score and the winner needs a margin over the runner-up.
   */

  function scoreFaqs(t) {
    // Strip generic carrier phrases so specific topic keywords win.
    const stripped = ' ' + t.replace(
      /tell me about|let me know about|what about|how about|i want to know|information about|info about|anything about|tell me|something about|can you|could you|please/g, ' '
    ) + ' ';
    const s = stripped.replace(/\s+/g, ' ');
    return KB.faqs.map((faq) => {
      let score = 0;
      faq.keywords.forEach((kw) => {
        const words = kw.split(' ').length;
        // Single-word keywords must match whole words ("work" should not match "network").
        // Simple plural stemming so "papers" matches the "paper" keyword.
        const hit = words > 1
          ? s.indexOf(kw) !== -1
          : (s.indexOf(' ' + kw + ' ') !== -1 || s.indexOf(' ' + kw + 's ') !== -1 || s.indexOf(' ' + kw + 'es ') !== -1);
        if (hit) score += words > 1 ? words * 2 : 1.5;
      });
      return { faq: faq, score: score };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
  }

  function detectSection(t) {
    return Object.keys(KB.sections).find((name) => t.indexOf(name) !== -1) || null;
  }

  // Returns {intent, score, data, ranked} where ranked is all candidates.
  function detectIntent(rawInput) {
    const t = norm(rawInput);
    const toks = tokens(t);
    const short = t.trim().length < 28;
    const cands = [];
    const add = (intent, score, data) => cands.push({ intent: intent, score: score, data: data || {} });

    const pronoun = hasPronoun(t);
    const nameMatches = matchProjectNames(t, toks);
    const orgMatches = matchOrgEntities(t);

    // --- explicit high-confidence intents ---
    if (toks.length <= 4 && /\b(hello|hi|hey|yo|sup|namaste|vanakkam|hiya|howdy)\b/.test(t)) {
      add('greeting', 6);
    }
    if (has(t, 'thank', 'nandri') || word(t, 'thanks')) add('thanks', 6);
    if (word(t, 'resume') || word(t, 'cv') || has(t, 'curriculum vitae')) {
      add('resume', 7);
    } else if (word(t, 'download') && !word(t, 'project') && !word(t, 'projects')) {
      add('resume', 3);
    }
    if (has(t, 'compare', 'comparison', 'versus', ' vs ', 'difference between', 'differ from', 'which is better')) {
      const ents = [];
      nameMatches.forEach((n) => { if (ents.indexOf(n) === -1) ents.push(n); });
      orgMatches.forEach((n) => {
        // Prefer the project interpretation of "Synergii" unless work words present.
        if (n === 'Synergii' && ents.indexOf('Synergii') !== -1) return;
        if (ents.indexOf(n) === -1) ents.push(n);
      });
      add('compare', 7, { entities: ents });
    }
    if ((word(t, 'email') || has(t, 'e-mail')) && has(t, 'draft', 'write', 'send', 'compose', 'open', 'create', 'start')) {
      add('email', 7);
    }
    // "tell me more" / "more about X" -> expand on current entity/topic
    if (has(t, 'tell me more', 'more about', 'elaborate', 'go on', 'expand on') ||
        (word(t, 'more') && (pronoun || short) && ctx.lastEntity)) {
      add('expand', 5.5);
    }
    // clear / show-all project filter
    if (has(t, 'show all', 'clear filter', 'clear the filter', 'clear highlight', 'reset filter') &&
        (word(t, 'project') || word(t, 'projects') || ctx.projectFilter)) {
      add('clearFilter', 7);
    }
    // "show more" of the current project results
    if (ctx.projectFilter && (has(t, 'show more') || t.trim() === 'more' ||
        (word(t, 'more') && (word(t, 'project') || word(t, 'projects'))))) {
      add('moreProjects', 7);
    }
    // refine: "only the X ones" within the current project results
    if (ctx.projectFilter && !word(t, 'project') && !word(t, 'projects')) {
      const rtoks = toks.filter((w) => !has(' ' + w + ' ', ' show ', ' me ', ' with ', ' that ', ' are ', ' the '));
      const tags = allTags();
      const tagHit = rtoks.some((w) => tags[w] || resolveAliases(' ' + w + ' ')[w]);
      if ((word(t, 'only') || word(t, 'just')) && rtoks.length) {
        add('refine', 6.5, { tokens: rtoks });
      } else if (rtoks.length && rtoks.every((w) => tags[w])) {
        add('refine', 6, { tokens: rtoks });
      } else if (tagHit && rtoks.length <= 3 && short) {
        add('refine', 5.5, { tokens: rtoks });
      }
    }
    // explicit navigation verbs
    const navSection = detectSection(t);
    if (navSection && has(t, 'take me to', 'scroll to', 'go to', 'navigate', 'open the', 'show me the', 'jump to')) {
      add('navigate', 6.5, { section: navSection });
    }

    // --- faq scoring ---
    const faqRanked = scoreFaqs(t);
    if (faqRanked.length) {
      add('faq', faqRanked[0].score, { faq: faqRanked[0].faq, ranked: faqRanked, nameMatches: nameMatches });
    }

    // --- projects intent ---
    let pScore = 0;
    const pData = { nameMatches: nameMatches, query: rawInput };
    if (word(t, 'project') || word(t, 'projects') || word(t, 'portfolio') || has(t, 'repos', 'repository', 'built')) pScore += 4;
    const aliasTags = resolveAliases(t);
    const tags = allTags();
    toks.forEach((tok) => {
      if (tags[tok] || aliasTags[tok]) pScore += 2;
    });
    pScore += nameMatches.length * 2.5;
    if (pScore > 0) add('projects', pScore, pData);

    // --- bare section mention ("education", "contact") ---
    if (navSection && short && !cands.length) {
      add('navigate', 3.5, { section: navSection });
    }

    // --- context boost: pronoun follow-ups attach to the last topic ---
    // Only pronoun-bearing messages consult memory. A fresh question that
    // merely contains "his"/"him" ("What are his skills?") names its own
    // topic and must NOT be hijacked by the previous one. Memory synthesis
    // fires only when the message has no content tokens at all ("there?").
    if (pronoun && ctx.lastTopic) {
      const lt = ctx.lastTopic;
      for (let i = 0; i < cands.length; i++) {
        if (cands[i].intent === 'faq' && cands[i].data.faq && cands[i].data.faq.id === lt) {
          cands[i].score += 4;
          cands[i].data.entityResolved = ctx.lastEntity;
        }
        if (cands[i].intent === 'projects' && lt === 'projects') cands[i].score += 4;
        if (cands[i].intent === 'navigate' && cands[i].data.section === lt) cands[i].score += 4;
      }
      // "there?" after a work answer: no faq keyword can hit, so synthesize
      // the topic intent from memory.
      if (!toks.length && !cands.some((c) => c.score >= 3.5) && KB.faqs.some((f) => f.id === lt)) {
        const faq = KB.faqs.find((f) => f.id === lt);
        add('faq', 4.5, { faq: faq, ranked: [{ faq: faq, score: 4.5 }], entityResolved: ctx.lastEntity, fromMemory: true });
      }
    }

    cands.sort((a, b) => b.score - a.score);

    // Prefer a matched FAQ over a bare project-name hit: "Tell me about
    // Synergii" should answer what Synergii is (with a follow-up chip to
    // show the project), not just filter the grid.
    let promoted = false;
    if (cands[0] && cands[0].intent === 'projects' && cands[0].score < 4) {
      for (let i = 1; i < cands.length; i++) {
        if (cands[i].intent === 'faq' && cands[i].score >= 1.5) {
          cands[i].score = cands[0].score + 0.5;
          promoted = true;
          break;
        }
      }
      cands.sort((a, b) => b.score - a.score);
    }

    const best = cands[0] || null;
    const second = cands[1] || null;
    return { intent: best ? best.intent : 'fallback', score: best ? best.score : 0, data: best ? best.data : {}, ranked: cands, second: second, promoted: promoted };
  }

  /* ---------------- response building ---------------- */

  function chip(label, send) {
    return { label: label, send: send || label };
  }

  function defaultChips() {
    return KB.suggestions.map((s) => chip(s, s));
  }

  function summarizeProjects(result, opts) {
    opts = opts || {};
    if (!result || !result.ok || !result.matches.length) {
      const retry = ctx.projectFilter && ctx.projectFilter.names.length
        ? ' Still showing your earlier ' + ctx.projectFilter.names.length + ' matches below the fold - say "show all projects" to reset.'
        : '';
      return {
        html: "I couldn't find projects matching that - try “AI”, “game”, “Python”, or “web”." + retry,
        chips: [chip('Show all projects', 'show all projects')]
      };
    }
    const total = result.matches.length;
    const shown = opts.append ? (ctx.projectFilter ? ctx.projectFilter.shown : 6) : 6;
    if (ctx.projectFilter) ctx.projectFilter.shown = shown;
    const ms = result.matches.slice(0, shown);
    const items = ms.map((p) =>
      '<a href="' + esc(p.url || '#') + '" target="_blank" rel="noopener"><strong>' + esc(p.name) + '</strong></a>' +
      (p.language ? ' <span class="chat-tag">' + esc(p.language) + '</span>' : '') +
      '<br><span class="chat-dim">' + esc((p.description || '').slice(0, 110)) + '</span>'
    ).join('<br><br>');
    const lead = opts.refined
      ? 'Narrowed it down to <strong>' + total + '</strong> - highlighted in the Projects section:<br><br>'
      : 'Found <strong>' + total + '</strong> matching project' + (total === 1 ? '' : 's') + ' - highlighted in the Projects section:<br><br>';
    tools.navigateTo('projects');
    const chips = [];
    if (total > shown) chips.push(chip('Show more (' + (total - shown) + ' more)', 'show more projects'));
    chips.push(chip('Show all projects', 'show all projects'));
    chips.push(chip('Download his resume', 'download his resume'));
    return { html: lead + items, chips: chips.slice(0, 4) };
  }

  function buildCompare(entities) {
    const infos = entities.map(entityInfo).filter(Boolean);
    if (infos.length < 2) {
      const missing = infos.length === 0 ? 'two things' : 'one more thing';
      return {
        html: 'I can compare projects or roles side by side - but I need ' + missing +
              ' to compare. Try “compare Synergii and Spotify-Transformer”.',
        chips: [chip('Compare Synergii and Spotify-Transformer'), chip('Show me his AI projects', 'show me his AI projects')]
      };
    }
    const cards = infos.slice(0, 2).map((info) => {
      const rows = info.rows.map((r) =>
        '<div class="k7-cmp-row"><span class="k7-cmp-k">' + esc(r[0]) + '</span><span>' + r[1] + '</span></div>'
      ).join('');
      return '<div class="k7-compare-card"><strong>' + esc(info.title) + '</strong>' + rows + '</div>';
    }).join('');
    return {
      html: 'Here they are side by side:<div class="k7-compare">' + cards + '</div>',
      chips: [chip('Show me his AI projects', 'show me his AI projects')]
    };
  }

  function buildClarify(candidates, input) {
    const chips = candidates.slice(0, 3).map((c) => chip(c.label, c.send));
    chips.push(chip('Never mind', 'never mind'));
    return {
      html: 'I want to get this right - which did you mean?',
      chips: chips
    };
  }

  function candidateChipsFor(ranked) {
    const out = [];
    const seen = {};
    ranked.slice(0, 3).forEach((c) => {
      let label = null, send = null;
      if (c.intent === 'faq' && c.data.faq) {
        const id = c.data.faq.id;
        label = { work: 'His work at Meta', entrepreneur: 'Synergii (his startup)', research: 'His research', education: 'His education', skills: 'His skills', contact: 'How to contact him', location: 'Where he lives', who: 'Who he is' }[id] || 'About ' + id;
        send = label;
      } else if (c.intent === 'projects') {
        label = 'His projects'; send = 'show me his projects';
      } else if (c.intent === 'navigate' && c.data.section) {
        label = 'Go to ' + c.data.section; send = 'take me to ' + c.data.section;
      } else if (c.intent === 'resume') {
        label = 'Download resume'; send = 'download his resume';
      } else if (c.intent === 'compare') {
        label = 'Compare two items'; send = 'compare Synergii and Spotify-Transformer';
      }
      if (label && !seen[label]) { seen[label] = true; out.push(chip(label, send)); }
    });
    return out;
  }

  // Multi-step email draft: pending state machine.
  function continuePending(input) {
    const p = ctx.pending;
    const t = norm(input);
    if (has(t, 'cancel', 'never mind', 'nevermind', 'stop', 'forget it')) {
      ctx.pending = null;
      remember(input, 'cancelled', 'email', ctx.lastEntity);
      return { html: 'No problem - email draft cancelled.', chips: defaultChips() };
    }
    if (p.kind === 'email') {
      if (p.step === 'name') {
        const name = String(input).replace(/^(my name is|i'm|i am|im|this is|it's)\s+/i, '').trim().slice(0, 60) || 'there';
        p.data.name = name;
        p.step = 'purpose';
        return { html: 'Thanks, ' + esc(name) + '. What\u2019s the email about? A sentence is fine.', chips: null };
      }
      if (p.step === 'purpose') {
        p.data.purpose = String(input).slice(0, 300);
        ctx.pending = null;
        const subject = 'Hello Keshavan' + (p.data.name !== 'there' ? ' - ' + p.data.name : '');
        const body = 'Hi Keshavan,\n\n' + p.data.purpose + '\n\nBest,\n' + p.data.name;
        tools.composeEmail(subject, body);
        remember(input, 'email', 'email', ctx.lastEntity);
        return {
          html: 'Opened an email draft to <strong>' + esc(EMAIL) + '</strong> with your details filled in - just hit send in your mail app. ' +
                'If nothing opened, <a href="mailto:' + esc(EMAIL) + '">click here</a> instead.',
          chips: [chip('Show me his AI projects', 'show me his AI projects')]
        };
      }
    }
    ctx.pending = null;
    return { html: "Let's start over - what would you like to know about Keshavan?", chips: defaultChips() };
  }

  /* ---------------- plan -> act -> summarize ---------------- */

  function buildPlan(det, input) {
    const t = norm(input);

    // Low confidence -> ask a clarifying question instead of guessing.
    if (det.score < 1.25) {
      const cands = candidateChipsFor(det.ranked);
      return { kind: 'clarify', candidates: cands, low: true };
    }
    // Close race between top candidates -> disambiguate. Skipped when the
    // faq was deliberately promoted over a bare project-name hit.
    if (!det.promoted && det.second && det.score < 5 && (det.score - det.second.score) < 0.75 && det.second.score > 0) {
      const cands = candidateChipsFor(det.ranked);
      if (cands.length >= 2) return { kind: 'clarify', candidates: cands, low: false };
    }

    switch (det.intent) {
      case 'greeting':
        return { kind: 'reply', topic: null,
          html: "Hey! I'm Keshavan's site assistant. Ask me about his work, projects, education - or flip the <strong>AI</strong> switch up top for AI answers powered by the Gemini API.",
          chips: defaultChips() };
      case 'thanks':
        return { kind: 'reply', topic: null,
          html: "You're welcome! Anything else you'd like to know about Keshavan?", chips: defaultChips() };
      case 'resume':
        return { kind: 'act', narrate: 'Grabbing his resume…', topic: null,
          run: () => tools.downloadResume(),
          html: 'Done - <strong>resume.pdf</strong> should be downloading now. It covers his Meta work, Prudential ML systems, research, and education.',
          chips: defaultChips() };
      case 'email':
        ctx.pending = { kind: 'email', step: 'name', data: {} };
        return { kind: 'reply', topic: 'email',
          html: "Sure - I'll open an email draft to him. What's <strong>your name</strong>? (Say “cancel” anytime to stop.)",
          chips: null };
      case 'compare':
        return { kind: 'reply', topic: 'compare', entity: ctx.lastEntity,
          build: () => buildCompare(det.data.entities || []) };
      case 'navigate': {
        const id = KB.sections[det.data.section];
        return { kind: 'act', topic: det.data.section,
          run: () => tools.navigateTo(id),
          html: 'On it - scrolled you to <strong>' + esc(det.data.section) + '</strong>.',
          chips: defaultChips() };
      }
      case 'clearFilter':
        return { kind: 'act', topic: 'projects',
          run: () => { tools.clearProjectFilter(); tools.navigateTo('projects'); return { ok: true }; },
          html: 'Cleared - showing all projects again.',
          chips: defaultChips() };
      case 'moreProjects': {
        if (ctx.projectFilter) ctx.projectFilter.shown = (ctx.projectFilter.shown || 6) + 6;
        const res = tools.filterProjects(ctx.projectFilter ? ctx.projectFilter.query : 'all');
        // restore full match list for pagination
        return { kind: 'reply', topic: 'projects', entity: ctx.lastEntity,
          build: () => summarizeProjects(res, { append: true }) };
      }
      case 'refine': {
        const scope = ctx.projectFilter ? ctx.projectFilter.names : null;
        const res = tools.filterProjects(det.data.tokens.join(' '), scope);
        if (ctx.projectFilter) {
          ctx.projectFilter.query = det.data.tokens.join(' ');
          ctx.projectFilter.names = res.matches.map((p) => p.name);
          ctx.projectFilter.shown = 6;
        }
        return { kind: 'reply', topic: 'projects', entity: res.matches.length ? 'project:' + res.matches[0].name : ctx.lastEntity,
          build: () => summarizeProjects(res, { refined: true }) };
      }
      case 'projects': {
        const res = tools.filterProjects(det.data.query || 'all');
        const entity = res.matches.length ? 'project:' + res.matches[0].name : null;
        const plan = { kind: 'reply', topic: 'projects', entity: entity,
          build: () => summarizeProjects(res) };
        if (res.matches.length) {
          ctx.projectFilter = { query: det.data.query || 'all', names: res.matches.map((p) => p.name), shown: 6 };
        }
        return plan;
      }
      case 'expand': {
        const ent = ctx.lastEntity && KB.entities[ctx.lastEntity] ? ctx.lastEntity : null;
        if (ent) {
          return { kind: 'reply', topic: ctx.lastTopic, entity: ent,
            html: KB.entities[ent].detail, chips: defaultChips() };
        }
        const label = ctx.lastTopic ? (TOPIC_LABEL[ctx.lastTopic] || ctx.lastTopic) : null;
        return { kind: 'reply', topic: ctx.lastTopic,
          html: label
            ? 'Happy to - what about ' + esc(label) + ' do you want to know?'
            : 'Sure - more about what? His work, projects, education, or research?',
          chips: label ? defaultChips() : [chip('His work', 'what does he work on'), chip('His projects', 'show me his projects'), chip('His education', 'what is his education')] };
      }
      case 'faq': {
        const faq = det.data.faq;
        const ent = det.data.entityResolved || det.data.fromMemory && ctx.lastEntity;
        const resolved = ent && KB.entities[ent] ? ent : null;
        // Pronoun follow-ups ("what does he do there?") get the entity-specific answer.
        const mentionsEntity = det.data.fromMemory || word(t, 'there') || word(t, 'here') ||
          has(t, 'about it') || has(t, 'more about') || word(t, 'more');
        const useEntity = resolved && mentionsEntity;
        const answer = useEntity ? KB.entities[resolved].detail : faq.answer;
        const plan = { kind: 'reply', topic: faq.id, entity: FAQ_ENTITY[faq.id] || resolved || ctx.lastEntity, html: answer, chips: null };
        if (faq.id === 'contact') plan.chips = [chip('Draft an email to him', 'draft an email to him')];
        else if (det.data.nameMatches && det.data.nameMatches.length) {
          plan.chips = [chip('Show the ' + det.data.nameMatches[0] + ' project', 'show me the ' + det.data.nameMatches[0] + ' project')];
        } else plan.chips = defaultChips();
        return plan;
      }
      default:
        return { kind: 'reply', topic: null,
          html: 'I can help with his <strong>work</strong>, <strong>projects</strong> (e.g. “show me AI projects”), <strong>education</strong>, or say <strong>“resume”</strong> to download his CV.',
          chips: defaultChips() };
    }
  }

  // One synchronous turn: plan -> act -> summarize. Shared by the live UI and tests.
  function runTurn(rawInput) {
    const input = String(rawInput == null ? '' : rawInput).trim();
    if (!input) return { html: '', chips: null };

    if (ctx.pending) return continuePending(input);

    if (input.toLowerCase() === 'never mind') {
      return { html: 'No problem - what else would you like to know?', chips: defaultChips() };
    }

    const det = detectIntent(input);
    const plan = buildPlan(det, input);

    let res;
    if (plan.kind === 'clarify') {
      res = { html: plan.html || 'I want to get this right - which did you mean?', chips: plan.candidates };
      remember(input, 'clarify', ctx.lastTopic, ctx.lastEntity);
      return res;
    }
    if (plan.kind === 'act') {
      let ok = true;
      try { const r = plan.run(); ok = !r || r.ok !== false; } catch (e) { ok = false; }
      res = { html: ok ? plan.html : "Hmm, that didn't work - try again?", chips: plan.chips, narrate: plan.narrate };
      remember(input, det.intent, plan.topic, plan.entity !== undefined ? plan.entity : ctx.lastEntity);
      return res;
    }
    // reply (possibly built lazily)
    res = plan.build ? plan.build() : { html: plan.html, chips: plan.chips };
    res.narrate = plan.narrate;
    remember(input, det.intent, plan.topic, plan.entity !== undefined ? plan.entity : ctx.lastEntity);
    return res;
  }

  const agent = {
    handle(input) {
      if (ai.ready) { aiTurn(input); return; }
      ui.typing(true);
      const delay = 450;
      setTimeout(() => {
        ui.typing(false);
        const r = runTurn(input);
        if (r.narrate) ui.status(r.narrate);
        if (r.html) ui.bot(r.html, { chips: r.chips });
      }, delay);
    }
  };

  /* ---------------- AI mode (Gemini API, default on) ----------------
   * Every question is answered by Google's Gemini API using the site's key
   * (GEMINI_API_KEY, referrer-restricted to this site in Google AI Studio).
   * The visitor's questions are sent to Google; nothing else leaves the
   * device. If the key is still the placeholder or the API is unreachable,
   * the fast built-in assistant answers instead. No toggle: AI is the default.
   */

  const ai = {
    ready: false,
    busy: false,
    history: [],
    MODEL: 'gemini-3.6-flash'
  };
  // AI is on by default. It becomes active once a real (non-placeholder)
  // referrer-restricted key is embedded above.
  ai.ready = typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.length > 0 &&
    GEMINI_API_KEY.indexOf('PLACEHOLDER') === -1;
  function buildSystemPrompt() {
    const L = [];
    L.push("You are the on-site assistant for Keshavan Seshadri's personal portfolio website (k7s3.github.io).");
    L.push("Answer ONLY using the facts below. If the answer is not in the facts, say exactly: \"I don't know that from Keshavan's site - you can email him at keshavanseshadri@gmail.com.\" Never invent dates, metrics, companies, papers, or achievements. Keep answers to 2-4 short sentences in a friendly tone.");
    L.push('FACTS:');
    L.push('- Name: ' + KB.profile.name + '. Location: ' + KB.profile.location + '. Tagline: ' + KB.profile.tagline + '.');
    L.push('- Current role: ' + KB.profile.role + ', working on ' + KB.profile.team + '.');
    L.push('- Work history:');
    timeline().forEach((e) => L.push('  * ' + (e.date || '') + ': ' + (e.title || '') + '. ' + (e.description || '')));
    L.push('- Education: ' + KB.profile.education.join('; '));
    L.push('- Skills: Python, C++, JavaScript, PyTorch, React, FastAPI, Docker, AWS and more (full list in the About section).');
    L.push('- Projects:');
    projects().forEach((p) => L.push('  * ' + p.name + ' (' + (p.language || 'n/a') + '): ' + (p.description || '')));
    L.push('- Publications:');
    publications().forEach((p) => L.push('  * ' + p.title + ' - ' + (p.venue || '') + ' ' + (p.year || '')));
    L.push('- Contact email: ' + EMAIL + '.');
    return L.join('\n');
  }

  async function aiTurn(input) {
    if (ai.busy) {
      ui.bot('Still working on your last question - give me a moment.');
      return;
    }
    ai.busy = true;
    const div = ui.botEl('');
    ui.typing(true);
    try {
      const body = {
        system_instruction: { parts: [{ text: buildSystemPrompt() }] },
        contents: ai.history.slice(-8).concat([{ role: 'user', parts: [{ text: input }] }]),
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 }
      };
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + ai.MODEL + ':generateContent?key=' + encodeURIComponent(GEMINI_API_KEY);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!resp.ok) throw new Error('the API returned status ' + resp.status);
      const data = await resp.json();
      const cand = data && data.candidates && data.candidates[0];
      const parts = cand && cand.content && cand.content.parts;
      let full = '';
      if (parts) parts.forEach((p) => { if (p && p.text) full += p.text; });
      ui.typing(false);
      if (!full.trim()) {
        div.innerHTML = 'The AI returned an empty reply - try rephrasing your question.';
      } else {
        div.innerHTML = esc(full).replace(/\n/g, '<br>');
        ui.scroll();
        ai.history.push({ role: 'user', parts: [{ text: input }] }, { role: 'model', parts: [{ text: full }] });
        if (ai.history.length > 12) ai.history = ai.history.slice(-12);
      }
    } catch (e) {
      ui.typing(false);
      div.remove();
      ui.bot('The AI service didn\u2019t respond (' + esc((e && e.message) || 'request failed') + ') - here\u2019s the built-in answer instead:');
      const r = runTurn(input);
      if (r.narrate) ui.status(r.narrate);
      if (r.html) ui.bot(r.html, { chips: r.chips });
    }
    ai.busy = false;
  }

  /* ---------------- UI ---------------- */

  const ui = {
    els: {},
    built: false,

    build() {
      if (this.built) return;
      this.built = true;

      const fab = document.createElement('button');
      fab.id = 'k7-chat-fab';
      fab.className = 'k7-chat-fab';
      fab.setAttribute('aria-label', 'Chat with Keshavan\'s site assistant');
      fab.setAttribute('aria-expanded', 'false');
      fab.innerHTML = '<i class="fas fa-comments"></i>';

      const panel = document.createElement('div');
      panel.id = 'k7-chat-panel';
      panel.className = 'k7-chat-panel';
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-label', "Chat with Keshavan's site assistant");
      panel.hidden = true;
      panel.innerHTML =
        '<div class="k7-chat-header">' +
          '<span class="k7-chat-avatar">K7</span>' +
          '<div class="k7-chat-title"><strong>Ask about Keshavan</strong><span class="k7-chat-online"><i></i>online</span></div>' +
          '<button class="k7-chat-close" aria-label="Close chat"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="k7-chat-messages" id="k7-chat-messages" aria-live="polite"></div>' +
        '<div class="k7-chat-chips" id="k7-chat-chips"></div>' +
        '<form class="k7-chat-input" id="k7-chat-form">' +
          '<input id="k7-chat-text" type="text" placeholder="Ask about work, projects…" autocomplete="off" aria-label="Type your message">' +
          '<button type="submit" aria-label="Send message"><i class="fas fa-paper-plane"></i></button>' +
        '</form>';

      document.body.appendChild(fab);
      document.body.appendChild(panel);

      this.els = {
        fab: fab, panel: panel,
        messages: $('#k7-chat-messages'),
        chips: $('#k7-chat-chips'),
        form: $('#k7-chat-form'),
        input: $('#k7-chat-text')
      };

      fab.addEventListener('click', () => this.toggle());
      panel.querySelector('.k7-chat-close').addEventListener('click', () => this.toggle(false));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !panel.hidden) this.toggle(false);
      });
      this.els.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.els.input.value.trim();
        if (!text) return;
        this.els.input.value = '';
        this.user(text);
        agent.handle(text);
      });

      this.bot(
        ai.ready
          ? "Hey! I'm Keshavan's site assistant, AI-powered by the Gemini API and grounded in this site. Ask me anything about his work, projects, or background - or tap a suggestion below."
          : "Hey! I'm Keshavan's site assistant - I can show you his projects, compare them, download his resume, draft an email to him, or answer questions about his work.",
        { chips: true }
      );
    },

    toggle(force) {
      const fab = this.els.fab, panel = this.els.panel, input = this.els.input;
      const open = typeof force === 'boolean' ? force : panel.hidden;
      panel.hidden = !open;
      fab.setAttribute('aria-expanded', String(open));
      fab.classList.toggle('open', open);
      if (open) setTimeout(() => input.focus(), 60);
    },

    scroll() {
      const m = this.els.messages;
      if (m) m.scrollTop = m.scrollHeight;
    },

    user(text) {
      const div = document.createElement('div');
      div.className = 'k7-msg k7-user';
      div.textContent = text;
      this.els.messages.appendChild(div);
      this.scroll();
    },

    botEl(html, cls) {
      const div = document.createElement('div');
      div.className = 'k7-msg k7-bot' + (cls ? ' ' + cls : '');
      div.innerHTML = html;
      this.els.messages.appendChild(div);
      this.scroll();
      return div;
    },

    bot(html, opts) {
      const div = this.botEl(html);
      this.chips((opts || {}).chips);
      return div;
    },

    status(text) {
      const div = document.createElement('div');
      div.className = 'k7-msg k7-status';
      div.innerHTML = '<i class="fas fa-bolt"></i> ' + esc(text);
      this.els.messages.appendChild(div);
      this.scroll();
      setTimeout(() => { div.classList.add('done'); }, 900);
    },

    typing(on) {
      let t = $('#k7-typing');
      if (on && !t) {
        t = document.createElement('div');
        t.id = 'k7-typing';
        t.className = 'k7-msg k7-bot k7-typing';
        t.innerHTML = '<span></span><span></span><span></span>';
        this.els.messages.appendChild(t);
        this.scroll();
      } else if (!on && t) {
        t.remove();
      }
    },

    chips(list) {
      const box = this.els.chips;
      if (!box) return;
      box.innerHTML = '';
      let items = null;
      if (list === true) items = defaultChips();
      else if (Array.isArray(list)) items = list.map((x) => typeof x === 'string' ? chip(x, x) : x);
      if (!items || !items.length) return;
      items.slice(0, 4).forEach((item) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'k7-chip';
        b.textContent = item.label;
        b.addEventListener('click', () => {
          this.user(item.label);
          agent.handle(item.send);
        });
        box.appendChild(b);
      });
    }
  };

  /* ---------------- boot ---------------- */

  document.addEventListener('DOMContentLoaded', () => {
    ui.build();
    // Test hook: agent internals for scripted verification.
    window.__k7Chatbot = {
      agent: agent, tools: tools, planFor: detectIntent, KB: KB, ctx: ctx,
      simulate: runTurn, reset: resetCtx, ui: ui,
      ai: { systemPrompt: buildSystemPrompt, model: ai.MODEL, turn: aiTurn, state: ai }
    };
  });
})();
