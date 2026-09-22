/* Agentic chatbot for k7s3.github.io
 *
 * Runs 100% client-side: no backend, no API keys, no network calls.
 * The agent parses the visitor's intent, picks tools, acts on the page,
 * then summarizes what it did (plan -> act -> summarize).
 *
 * Tools: navigateTo | filterProjects | clearProjectFilter |
 *        downloadResume | composeEmail | answerFaq
 *
 * Knowledge lives in chatbot-data.js (chatbotKB).
 */
(function () {
  'use strict';

  if (window.__k7Chatbot) return; // init once

  const KB = window.chatbotKB;
  const EMAIL = KB.profile.email;

  /* ---------------- utilities ---------------- */

  const $ = (sel, root) => (root || document).querySelector(sel);

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function norm(text) {
    return ' ' + String(text).toLowerCase().replace(/[’‘]/g, "'").trim() + ' ';
  }

  function has(t, ...words) {
    return words.some((w) => t.includes(w));
  }

  /* ---------------- tools ---------------- */

  const tools = {
    // Scroll to a site section. Returns the section id acted on.
    navigateTo(sectionId) {
      const el = document.getElementById(sectionId);
      if (!el) return { ok: false, sectionId };
      const top = el.getBoundingClientRect().top + window.pageYOffset - 70;
      window.scrollTo({ top, behavior: 'smooth' });
      return { ok: true, sectionId };
    },

    // Find projects matching a topic tag; highlight matches in the grid.
    filterProjects(rawQuery) {
      const query = norm(rawQuery);
      const all = (window.websiteData && window.websiteData.projects) || [];
      const aliasHit = Object.keys(KB.tagAliases).find((a) => query.includes(a));
      const canonical = aliasHit ? KB.tagAliases[aliasHit] : null;
      const tokens = query.split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1 && !STOP.has(w));
      if (canonical) tokens.push(canonical);

      // No topic given ("projects") -> show everything.
      if (!tokens.length) {
        highlightProjectCards(all.map((p) => p.name));
        return { ok: true, matches: all, query: rawQuery.trim() };
      }

      const scored = all.map((p) => {
        const tags = (KB.projectTags[p.name] || []).join(' ');
        const hay = norm([p.name, p.description, p.language, tags].filter(Boolean).join(' '));
        let score = 0;
        tokens.forEach((tok) => {
          if (tags.includes(tok)) score += 3;
          else if (hay.includes(tok)) score += 1;
        });
        return { project: p, score };
      }).filter((r) => r.score > 0)
        .sort((a, b) => b.score - a.score);

      const matches = scored.map((r) => r.project);
      highlightProjectCards(matches.map((p) => p.name));
      return { ok: true, matches, query: rawQuery.trim() };
    },

    clearProjectFilter() {
      const grid = $('#projects-container');
      if (grid) grid.classList.remove('chat-filter-active');
      grid && grid.querySelectorAll('.project-card.chat-match').forEach((c) => c.classList.remove('chat-match'));
      const pill = $('#chat-filter-pill');
      if (pill) pill.remove();
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
      return { ok: true, mailto };
    },

    answerFaq(faqId) {
      const faq = KB.faqs.find((f) => f.id === faqId);
      return faq ? { ok: true, answer: faq.answer } : { ok: false };
    }
  };

  const STOP = new Set([
    'the', 'and', 'for', 'with', 'show', 'showed', 'please', 'about',
    'what', 'which', 'does', 'are', 'his', 'her', 'him', 'your', 'you',
    'can', 'could', 'would', 'like', 'want', 'get', 'got', 'has', 'have',
    'some', 'any', 'all', 'its', "it's", 'that', 'this', 'those', 'these',
    'from', 'into', 'over', 'under', 'between', 'me'
  ]);

  function highlightProjectCards(names) {
    const grid = $('#projects-container');
    if (!grid) return;
    const set = new Set(names);
    grid.classList.add('chat-filter-active');
    grid.querySelectorAll('.project-card').forEach((card) => {
      card.classList.toggle('chat-match', set.has(card.dataset.projectName));
    });
    if (!$('#chat-filter-pill') && names.length) {
      const pill = document.createElement('button');
      pill.id = 'chat-filter-pill';
      pill.className = 'chat-filter-pill';
      pill.innerHTML = '<i class="fas fa-times"></i> Clear highlight (' + names.length + ' shown)';
      pill.setAttribute('aria-label', 'Clear project highlight');
      pill.addEventListener('click', () => agent.runPlan([{ tool: 'clearProjectFilter' }], true));
      const section = $('#projects .container');
      const title = section && section.querySelector('.section-title');
      if (title) title.after(pill);
    }
  }

  /* ---------------- intent router ---------------- */

  function detectFaq(t) {
    let best = null, bestScore = 0;
    KB.faqs.forEach((faq) => {
      let score = 0;
      faq.keywords.forEach((kw) => { if (t.includes(kw)) score += kw.split(' ').length; });
      if (score > bestScore) { bestScore = score; best = faq; }
    });
    return bestScore > 0 ? best : null;
  }

  function detectSection(t) {
    return Object.keys(KB.sections).find((name) => t.includes(name)) || null;
  }

  // Returns a plan: [{ tool, args, narrate }]
  function planFor(input) {
    const t = norm(input);
    const short = t.trim().length < 24;
    const lowered = String(input).toLowerCase();

    if (has(t, 'resume', 'cv')) {
      return {
        narrate: 'Grabbing his resume…',
        steps: [{ tool: 'downloadResume', args: [] }],
        reply: 'Done — <strong>resume.pdf</strong> should be downloading now. It covers his Meta work, Prudential ML systems, research, and education.'
      };
    }
    if (has(t, 'project')) {
      const topic = input.replace(/projects?/gi, '').trim();
      return {
        narrate: 'Scanning his projects…',
        steps: [{ tool: 'filterProjects', args: [topic || 'all'] }],
        dynamic: 'projects'
      };
    }
    if (has(t, 'email', 'e-mail') && has(t, 'draft', 'write', 'send', 'compose', 'open')) {
      return {
        narrate: 'Drafting an email…',
        steps: [{ tool: 'composeEmail', args: ['Hello Keshavan', 'Hi Keshavan,\n\n'] }],
        reply: 'Opened a pre-addressed email draft to <strong>' + esc(EMAIL) + '</strong> in your mail app — just fill in your message and hit send. If nothing opened, <a href="mailto:' + esc(EMAIL) + '">click here</a>.'
      };
    }
    if (short && /\b(hello|hi|hey|yo|sup|namaste|vanakkam)\b/.test(lowered)) {
      return { reply: "Hey! I'm Keshavan's site assistant. Ask me about his work, projects, education — or try one of the suggestions below.", chips: true };
    }
    if (has(t, 'thank', 'nandri')) {
      return { reply: "You're welcome! Anything else you'd like to know about Keshavan?" };
    }
    const navSection = detectSection(t);
    if (has(t, 'take me to', 'scroll to', 'go to', 'navigate', 'open the', 'show me the') && navSection) {
      const id = KB.sections[navSection];
      return {
        steps: [{ tool: 'navigateTo', args: [id] }],
        reply: 'On it — scrolled you to <strong>' + esc(navSection) + '</strong>.'
      };
    }
    const faq = detectFaq(t);
    if (faq) {
      const plan = {
        steps: [{ tool: 'answerFaq', args: [faq.id] }],
        dynamic: 'faq'
      };
      // Contact questions also offer the email draft as a follow-up chip
      if (faq.id === 'contact') plan.chips = ['Draft an email to him'];
      return plan;
    }
    if (navSection && short) {
      const id = KB.sections[navSection];
      return {
        steps: [{ tool: 'navigateTo', args: [id] }],
        reply: 'Taking you to <strong>' + esc(navSection) + '</strong>.'
      };
    }
    return {
      reply: "I can help with that differently — try asking about his <strong>work</strong>, <strong>projects</strong> (e.g. “show me AI projects”), <strong>education</strong>, or say <strong>“resume”</strong> to download his CV.",
      chips: true
    };
  }

  /* ---------------- agent loop ---------------- */

  const agent = {
    lastPlan: null,

    handle(input) {
      const plan = planFor(input);
      this.lastPlan = plan;
      this.runPlan(plan);
    },

    runPlan(plan, silent) {
      ui.typing(true);
      const delay = silent ? 60 : 450;
      setTimeout(() => {
        ui.typing(false);
        if (!silent && plan.narrate) ui.status(plan.narrate);
        const results = (plan.steps || []).map((s) => {
          try { return tools[s.tool].apply(null, s.args || []); }
          catch (e) { return { ok: false, error: String(e) }; }
        });
        if (silent) return;
        if (plan.dynamic === 'projects') this.summarizeProjects(results[0], plan);
        else if (plan.dynamic === 'faq') this.summarizeFaq(results[0], plan);
        else if (plan.reply) ui.bot(plan.reply, { chips: plan.chips });
      }, delay);
    },

    summarizeProjects(result, plan) {
      if (!result || !result.ok || !result.matches.length) {
        ui.bot("I couldn't find projects matching that — try “AI”, “game”, “Python”, or “web”. His full list is in the Projects section.", { chips: true });
        return;
      }
      const ms = result.matches.slice(0, 6);
      const items = ms.map((p) =>
        '<a href="' + esc(p.url || '#') + '" target="_blank" rel="noopener"><strong>' + esc(p.name) + '</strong></a>' +
        (p.language ? ' <span class="chat-tag">' + esc(p.language) + '</span>' : '') +
        '<br><span class="chat-dim">' + esc((p.description || '').slice(0, 110)) + '</span>'
      ).join('<br><br>');
      tools.navigateTo('projects');
      ui.bot(
        'Found <strong>' + result.matches.length + '</strong> matching project' +
        (result.matches.length === 1 ? '' : 's') +
        ' — highlighted them in the Projects section:<br><br>' + items,
        { chips: ['Show all projects', 'Download his resume'] }
      );
    },

    summarizeFaq(result, plan) {
      if (!result || !result.ok) {
        ui.bot("Hmm, I don't have that one yet — but his contact section is the best place to reach him.", { chips: true });
        return;
      }
      ui.bot(result.answer, { chips: plan.chips });
    }
  };

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
        fab, panel,
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
        "Hey! I'm Keshavan's site assistant — I can show you his projects, download his resume, draft an email to him, or answer questions about his work.",
        { chips: true }
      );
    },

    toggle(force) {
      const { fab, panel, input } = this.els;
      const open = typeof force === 'boolean' ? force : panel.hidden;
      panel.hidden = !open;
      fab.setAttribute('aria-expanded', String(open));
      fab.classList.toggle('open', open);
      if (open) setTimeout(() => input.focus(), 60);
    },

    scroll() {
      const m = this.els.messages;
      m.scrollTop = m.scrollHeight;
    },

    user(text) {
      const div = document.createElement('div');
      div.className = 'k7-msg k7-user';
      div.textContent = text;
      this.els.messages.appendChild(div);
      this.scroll();
    },

    bot(html, opts) {
      opts = opts || {};
      const div = document.createElement('div');
      div.className = 'k7-msg k7-bot';
      div.innerHTML = html;
      this.els.messages.appendChild(div);
      this.scroll();
      this.chips(opts.chips);
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
      box.innerHTML = '';
      const items = list === true ? KB.suggestions : list;
      if (!items || !items.length) return;
      items.slice(0, 4).forEach((label) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'k7-chip';
        b.textContent = label;
        b.addEventListener('click', () => {
          this.user(label);
          if (label === 'Show all projects') {
            tools.clearProjectFilter();
            tools.navigateTo('projects');
            this.bot('Showing all projects — the highlight is cleared.');
          } else if (label === 'Draft an email to him') {
            agent.handle('draft an email to him');
          } else {
            agent.handle(label);
          }
        });
        box.appendChild(b);
      });
    }
  };

  /* ---------------- boot ---------------- */

  document.addEventListener('DOMContentLoaded', () => {
    ui.build();
    window.__k7Chatbot = { agent, tools, planFor, KB }; // test hook
  });
})();
