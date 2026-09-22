// Chatbot knowledge base for k7s3.github.io
// Local data only: the chatbot answers from this file and the site's own
// data.js. No network calls, no API keys. Update the facts here and the
// chatbot picks them up automatically.

const chatbotKB = {
  profile: {
    name: "Keshavan Seshadri",
    shortName: "Keshavan",
    // Public-safe current role wording (Keshavan, 2026-09-21):
    // "product-centric ads ranking at Meta" is approved; internal team/org
    // names stay off the public site.
    role: "Software Engineer (E4) at Meta",
    team: "product-centric ads ranking",
    location: "New York City",
    education: [
      "Cornell Tech — M.Eng Computer Science",
      "IIIT Hyderabad — Master's by Research (Computational Natural Sciences) + B.Tech Computer Science"
    ],
    email: "keshavanseshadri@gmail.com",
    tagline: "AI Researcher • Software Engineer • Entrepreneur"
  },

  // Section anchors the chatbot can navigate to
  sections: {
    home: "home",
    about: "about",
    experience: "timeline",
    timeline: "timeline",
    career: "timeline",
    work: "timeline",
    education: "education",
    school: "education",
    college: "education",
    entrepreneurship: "entrepreneurship",
    startup: "entrepreneurship",
    startups: "entrepreneurship",
    publications: "publications",
    papers: "publications",
    research: "publications",
    projects: "projects",
    speaking: "speaking",
    talks: "speaking",
    contact: "contact",
    email: "contact",
    photos: "instagram",
    pictures: "instagram",
    instagram: "instagram"
  },

  // FAQ answers: each entry lists trigger keywords and the answer.
  // Keep answers short (1-3 sentences) and public-safe.
  faqs: [
    {
      id: "who",
      keywords: ["who is", "who's", "about keshavan", "about him", "tell me about", "introduce", "background", "bio"],
      answer: "Keshavan Seshadri is a Software Engineer (E4) at Meta in New York City, working on product-centric ads ranking. He's also an AI researcher and entrepreneur, with degrees from Cornell Tech and IIIT Hyderabad."
    },
    {
      id: "work",
      keywords: ["where does he work", "where does keshavan work", "where work", "work", "works", "job", "employer", "meta", "work on", "what does he do", "role", "team", "ads ranking"],
      answer: "He's a Software Engineer (E4) at Meta in NYC, working on product-centric ads ranking. Before Meta he was a Senior ML Engineer at Prudential Financial, building a real-time Table Augmented Generation system."
    },
    {
      id: "education",
      keywords: ["education", "degree", "studied", "university", "college", "school", "cornell", "iiit", "gpa", "masters"],
      answer: "He has an M.Eng in Computer Science from Cornell Tech (GPA 3.92/4.0), and a Master's by Research in Computational Natural Sciences plus a B.Tech in Computer Science from IIIT Hyderabad."
    },
    {
      id: "entrepreneur",
      keywords: ["startup", "founder", "entrepreneur", "synergii", "company", "founded"],
      answer: "He's the technical founder of Synergii, an AI-powered grant discovery platform he built end to end (RAG, GPT-4, BERT) through Cornell's Johnson Summer Startup Accelerator. You can see it in his projects below — I can show you his AI projects if you'd like."
    },
    {
      id: "research",
      keywords: ["research", "publication", "paper", "gpcr", "phd", "published"],
      answer: "His research includes molecular dynamics + ML studies of GPCR activation (Journal of Chemical Information and Modeling, 2023) and the 3Dmol.js learning environment (Journal of Chemical Education, 2020). Scroll to Publications for both papers."
    },
    {
      id: "contact",
      keywords: ["contact", "email", "reach", "hire", "collaborate", "get in touch", "talk to"],
      answer: "The fastest way is email: keshavanseshadri@gmail.com. I can open a pre-addressed email draft for you, or scroll you to the contact section."
    },
    {
      id: "location",
      keywords: ["where", "live", "based", "location", "city"],
      answer: "He's based in the New York City metropolitan area."
    },
    {
      id: "skills",
      keywords: ["skills", "languages", "stack", "technologies", "python", "pytorch", "tech stack"],
      answer: "Python, C++, JavaScript, PyTorch, React, FastAPI, Docker, AWS and more — the full list is in the About section."
    }
  ],

  // Project topic tags used by the "show me X projects" tool.
  // Keys are project names as they appear in data.js.
  projectTags: {
    "Synergii": ["ai", "ml", "web", "rag", "startup"],
    "Endless-Runner": ["game", "web", "webgl"],
    "K7-Shell": ["systems", "c"],
    "GPCR_ML_Residue_Importance": ["ml", "research", "python", "science"],
    "Researcher": ["ai", "agents", "python"],
    "Spotify-Transformer": ["ai", "python", "audio"],
    "SimulationCity": ["game", "web"],
    "3A-AgenticAutoApply": ["ai", "agents"],
    "Understudy-Agent": ["ai", "agents", "llm"],
    "Web-Scraping-Amazon-books-": ["python", "data"],
    "K7S3.github.io": ["web"],
    "AutoEHR": ["ai", "health"],
    "Attendance-System-Using-Image-Recognition": ["ml", "python", "cv"],
    "Multi-Modal-Models-for-Molecualr-Dynamics-Simulations.": ["ml", "research", "science"]
  },

  // Friendly aliases visitors might type -> canonical tag
  tagAliases: {
    "machine learning": "ml",
    "artificial intelligence": "ai",
    "llms": "llm",
    "agent": "agents",
    "agentic": "agents",
    "games": "game",
    "gaming": "game",
    "website": "web",
    "frontend": "web",
    "data science": "data",
    "computer vision": "cv",
    "systems programming": "systems"
  },

  suggestions: [
    "Show me his AI projects",
    "What does he work on?",
    "Download his resume",
    "How do I contact him?"
  ]
};
