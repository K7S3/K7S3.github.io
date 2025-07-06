// Hide loader when page is loaded
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
    }, 1000);
});

// Initialize AOS
AOS.init({
    duration: 1000,
    once: true,
    offset: 100
});

// Navbar functionality
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const navToggle = document.querySelector('.nav-toggle');
    const navMobileMenu = document.querySelector('.nav-mobile-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    const navbar = document.querySelector('.navbar');

    // Toggle mobile menu
    navToggle.addEventListener('click', function() {
        navToggle.classList.toggle('active');
        navMobileMenu.classList.toggle('active');
        document.body.style.overflow = navMobileMenu.classList.contains('active') ? 'hidden' : 'auto';
    });

    // Close mobile menu when clicking on a link
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (navMobileMenu.classList.contains('active')) {
                navToggle.classList.remove('active');
                navMobileMenu.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!navToggle.contains(e.target) && !navMobileMenu.contains(e.target)) {
            navToggle.classList.remove('active');
            navMobileMenu.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });

    // Keyboard navigation for mobile menu
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && navMobileMenu.classList.contains('active')) {
            navToggle.classList.remove('active');
            navMobileMenu.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });

    // Logo click to scroll to top
    const logo = document.querySelector('.nav-logo');
    logo.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Smooth scrolling for nav links
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            
            if (targetSection) {
                const offsetTop = targetSection.offsetTop - 80; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Navbar scroll effect and active link highlighting
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        
        // Add scrolled class to navbar
        if (scrolled > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }

        // Highlight active nav link
        const sections = document.querySelectorAll('section[id]');
        let currentSection = '';

        sections.forEach(section => {
            const sectionTop = section.offsetTop - 100;
            const sectionHeight = section.clientHeight;
            
            if (scrolled >= sectionTop && scrolled < sectionTop + sectionHeight) {
                currentSection = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSection}`) {
                link.classList.add('active');
            }
        });
    });

    // Add interactive click effects
    // Add ripple effect to buttons
    const buttons = document.querySelectorAll('.btn, .social-link, .project-link, .venture-link');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 50%;
                pointer-events: none;
                transform: scale(0);
                animation: ripple 0.6s ease-out;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // Add hover sound effect (visual feedback)
    const interactiveElements = document.querySelectorAll('.skill-card, .timeline-item, .publication-card, .news-item, .speaking-card');
    interactiveElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            this.style.transform = this.style.transform + ' scale(1.02)';
        });
        
        element.addEventListener('mouseleave', function() {
            this.style.transform = this.style.transform.replace(' scale(1.02)', '');
        });
    });
    
    // Add parallax effect to hero section
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const parallax = document.querySelector('.hero-image');
        if (parallax) {
            const speed = scrolled * 0.5;
            parallax.style.transform = `translateY(${speed}px)`;
        }
    });
    
    // Add typing animation to hero title
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        const text = heroTitle.textContent;
        heroTitle.textContent = '';
        let i = 0;
        const typeWriter = () => {
            if (i < text.length) {
                heroTitle.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 80);
            } else {
                // Typing complete - no cursor needed
                heroTitle.style.borderRight = 'none';
                heroTitle.style.animation = 'none';
            }
        };
        setTimeout(typeWriter, 1000);
    }
    
    // Add mouse trail effect
    let mouseTrail = [];
    document.addEventListener('mousemove', function(e) {
        mouseTrail.push({
            x: e.clientX,
            y: e.clientY,
            time: Date.now()
        });
        
        // Limit trail length
        if (mouseTrail.length > 20) {
            mouseTrail.shift();
        }
        
        // Create sparkle at mouse position occasionally
        if (Math.random() < 0.1) {
            createSparkle(e.clientX, e.clientY);
        }
    });
    
    // Create sparkle effect
    function createSparkle(x, y) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: 4px;
            height: 4px;
                            background: var(--gradient-professional);
            border-radius: 50%;
            pointer-events: none;
            z-index: 9999;
            animation: sparkle 1s ease-out forwards;
        `;
        document.body.appendChild(sparkle);
        
        setTimeout(() => {
            sparkle.remove();
        }, 1000);
    }
    
    // Add scroll-triggered animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.8s ease forwards';
                entry.target.style.opacity = '1';
            }
        });
    }, observerOptions);
    
    // Observe all cards and sections
    const elementsToAnimate = document.querySelectorAll('.skill-card, .timeline-item, .publication-card, .news-item, .speaking-card, .education-card');
    elementsToAnimate.forEach(el => {
        el.style.opacity = '0';
        observer.observe(el);
    });
});

// Particles.js configuration
particlesJS('particles-js', {
    particles: {
        number: {
            value: 80,
            density: {
                enable: true,
                value_area: 800
            }
        },
        color: {
            value: '#6366f1'
        },
        shape: {
            type: 'circle'
        },
        opacity: {
            value: 0.5,
            random: false
        },
        size: {
            value: 3,
            random: true
        },
        line_linked: {
            enable: true,
            distance: 150,
            color: '#6366f1',
            opacity: 0.4,
            width: 1
        },
        move: {
            enable: true,
            speed: 2,
            direction: 'none',
            random: false,
            straight: false,
            out_mode: 'out',
            bounce: false
        }
    },
    interactivity: {
        detect_on: 'canvas',
        events: {
            onhover: {
                enable: true,
                mode: 'grab'
            },
            onclick: {
                enable: true,
                mode: 'push'
            },
            resize: true
        },
        modes: {
            grab: {
                distance: 140,
                line_linked: {
                    opacity: 1
                }
            },
            push: {
                particles_nb: 4
            }
        }
    },
    retina_detect: true
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Mobile navigation toggle
const navToggle = document.querySelector('.nav-toggle');
const navMenu = document.querySelector('.nav-menu');

navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

// GitHub API Integration
async function fetchGitHubProjects() {
    try {
        // First try to use the pre-fetched data
        if (typeof websiteData !== 'undefined' && websiteData.projects) {
            const projectsContainer = document.getElementById('projects-container');
            projectsContainer.innerHTML = '';
            
            websiteData.projects.slice(0, 6).forEach((project, index) => {
                const projectCard = createProjectCard(project, index);
                projectsContainer.appendChild(projectCard);
            });
        } else {
            // Fallback to direct API call
            const response = await fetch('https://api.github.com/users/K7S3/repos?sort=updated&per_page=6');
            const repos = await response.json();
            
            const projectsContainer = document.getElementById('projects-container');
            projectsContainer.innerHTML = '';
            
            repos.forEach((repo, index) => {
                const projectCard = createProjectCard(repo, index);
                projectsContainer.appendChild(projectCard);
            });
        }
    } catch (error) {
        console.error('Error fetching GitHub projects:', error);
    }
}

function createProjectCard(project, index) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.setAttribute('data-aos', 'fade-up');
    card.setAttribute('data-aos-delay', index * 100);
    
    const languages = project.language ? [project.language] : [];
    const techTags = languages.map(lang => `<span class="tech-tag">${lang}</span>`).join('');
    
    // Handle both formats (from API and from our data)
    const url = project.url || project.html_url;
    const description = project.description || 'No description available';
    
    card.innerHTML = `
        <div class="project-header">
            <h3>${project.name}</h3>
        </div>
        <div class="project-content">
            <p class="project-description">${description}</p>
            <div class="project-tech">
                ${techTags}
            </div>
            <div class="project-links">
                <a href="${url}" target="_blank" class="project-link">
                    <i class="fab fa-github"></i> View Code
                </a>
                ${project.homepage ? `<a href="${project.homepage}" target="_blank" class="project-link">
                    <i class="fas fa-external-link-alt"></i> Live Demo
                </a>` : ''}
            </div>
        </div>
    `;
    
    return card;
}

// Google Scholar Publications Scraper
async function fetchPublications() {
    let publications = [];
    
    // Use pre-fetched data if available
    if (typeof websiteData !== 'undefined' && websiteData.publications) {
        publications = websiteData.publications;
    } else {
        // Fallback to static data
        publications = [
            {
                title: "A Computational Study on GPCR Activation Mechanisms: Insights from Adrenaline Binding and G-Protein Dissociation",
                authors: "Keshavan Seshadri et al.",
                venue: "International Institute of Information Technology, Hyderabad",
                year: "2023",
                abstract: "GPCRs are the most prominent family of membrane proteins that serve as major targets for one-third of the drugs produced. A detailed understanding of the molecular mechanism of drug-induced activation and inhibition of GPCRs is crucial for the rational design of novel therapeutics.",
                url: "https://scholar.google.com/citations?user=3M3fxRYAAAAJ"
            }
        ];
    }
    
    const publicationsContainer = document.getElementById('publications-container');
    publicationsContainer.innerHTML = '';
    
    publications.forEach((pub, index) => {
        const pubCard = createPublicationCard(pub, index);
        publicationsContainer.appendChild(pubCard);
    });
}

function createPublicationCard(pub, index) {
    const card = document.createElement('div');
    card.className = 'publication-card';
    card.setAttribute('data-aos', 'fade-up');
    card.setAttribute('data-aos-delay', index * 100);
    
    const imageHtml = pub.image ? `
        <div class="publication-image">
            <img src="${pub.image}" alt="${pub.title}" />
        </div>
    ` : '';
    
    // Truncate abstract for display with "Read more" functionality
    const maxAbstractLength = 300;
    let abstractHtml = '';
    if (pub.abstract) {
        if (pub.abstract.length > maxAbstractLength) {
            const truncated = pub.abstract.substring(0, maxAbstractLength) + '...';
            abstractHtml = `
                <p class="publication-abstract">
                    <span class="abstract-truncated">${truncated}</span>
                    <span class="abstract-full" style="display: none;">${pub.abstract}</span>
                    <a href="#" class="read-more-link" onclick="toggleAbstract(event, this)">Read more</a>
                </p>
            `;
        } else {
            abstractHtml = `<p class="publication-abstract">${pub.abstract}</p>`;
        }
    }
    
    // Format venue information
    let venueInfo = pub.venue;
    if (pub.volume && pub.pages) {
        venueInfo += ` ${pub.volume}, ${pub.pages}`;
    }
    venueInfo += ` (${pub.year})`;
    
    card.innerHTML = `
        <div class="publication-content">
            <div class="publication-text">
                <h3>${pub.title}</h3>
                <p class="publication-authors">${pub.authors}</p>
                <p class="publication-venue">${venueInfo}</p>
                ${pub.thesis_number ? `<p class="publication-thesis-number">Thesis No: ${pub.thesis_number}</p>` : ''}
                ${abstractHtml}
                <div class="publication-stats">
                    ${pub.type !== 'thesis' ? `<span class="citation-count"><i class="fas fa-quote-right"></i> ${pub.citations || 0} citations</span>` : ''}
                    ${pub.doi ? `<span class="publication-doi">DOI: ${pub.doi}</span>` : ''}
                </div>
                <div class="publication-links">
                    <a href="${pub.url || pub.link}" target="_blank" class="publication-link">
                        <i class="fas fa-external-link-alt"></i> ${pub.type === 'thesis' ? 'View Thesis' : 'Read Full Paper'}
                    </a>
                </div>
            </div>
            ${imageHtml}
        </div>
    `;
    
    return card;
}

// LinkedIn Timeline Parser
function loadTimeline() {
    let timelineData = [];
    
    // Use pre-fetched data if available
    if (typeof websiteData !== 'undefined' && websiteData.timeline) {
        timelineData = websiteData.timeline.map((item, index) => ({
            ...item,
            side: index % 2 === 0 ? "right" : "left"
        }));
    } else {
        // Fallback to static data
        timelineData = [
            {
                date: "Present",
                title: "Prudential Financial",
                description: "Working on innovative financial technology solutions and AI applications",
                side: "right"
            },
            {
                date: "2024",
                title: "Break Through Tech Mentor",
                description: "Mentoring students to help them get into Tech and AI",
                side: "left"
            },
            {
                date: "2023",
                title: "Cornell University",
                description: "Graduated with degree in Computer Science",
                side: "right"
            },
            {
                date: "2023",
                title: "IIIT Hyderabad Research",
                description: "Published research on GPCR Activation Mechanisms",
                side: "left"
            },
            {
                date: "2022",
                title: "LinkedIn Learning",
                description: "Completed SQL: Data Reporting and Analysis certification",
                side: "right"
            }
        ];
    }
    
    const timelineContainer = document.getElementById('timeline-container');
    timelineContainer.innerHTML = '';
    
    timelineData.forEach((item, index) => {
        const timelineItem = createTimelineItem(item, index);
        timelineContainer.appendChild(timelineItem);
    });
}

function createTimelineItem(item, index) {
    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.setAttribute('data-aos', item.side === 'right' ? 'fade-right' : 'fade-left');
    div.setAttribute('data-aos-delay', index * 100);
    
    div.innerHTML = `
        <div class="timeline-date">${item.date}</div>
        <div class="timeline-content">
            <h3>${item.title}</h3>
            <p>${item.description}</p>
        </div>
    `;
    
    return div;
}

// Advanced AI Chatbot with Enhanced Intelligence
class AdvancedChatbot {
    constructor() {
        this.isOpen = false;
        this.context = [];
        this.userProfile = {
            name: null,
            interests: [],
            visitCount: parseInt(localStorage.getItem('chatbot_visits') || '0') + 1,
            lastVisit: localStorage.getItem('chatbot_last_visit'),
            conversationHistory: JSON.parse(localStorage.getItem('chatbot_history') || '[]')
        };
        this.isTyping = false;
        this.suggestions = [];
        this.init();
    }

    init() {
        localStorage.setItem('chatbot_visits', this.userProfile.visitCount.toString());
        localStorage.setItem('chatbot_last_visit', new Date().toISOString());
        this.setupVoiceRecognition();
        this.setupSuggestions();
        this.showWelcomeMessage();
    }

    setupVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                document.getElementById('chatbot-input').value = transcript;
                this.sendMessage();
            };

            this.recognition.onerror = (event) => {
                console.log('Speech recognition error:', event.error);
            };
        }
    }

    setupSuggestions() {
        this.suggestions = [
            "Tell me about Keshavan's projects",
            "What's his technical experience?",
            "How can I contact him?",
            "What are his research interests?",
            "Show me his achievements",
            "What skills does he have?",
            "Tell me about his education",
            "What's he working on now?"
        ];
    }

    toggleChatbot() {
        const chatbot = document.getElementById('chatbot');
        this.isOpen = !this.isOpen;
        chatbot.classList.toggle('active');
        
        if (this.isOpen) {
            this.trackEvent('chatbot_opened');
            document.getElementById('chatbot-input').focus();
        }
    }

    async sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();
        
        if (!message) return;

        this.addMessage(message, 'user');
        input.value = '';
        this.clearSuggestions();
        
        // Add to conversation history
        this.context.push({ role: 'user', content: message, timestamp: Date.now() });
        this.userProfile.conversationHistory.push({ message, sender: 'user', timestamp: Date.now() });
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Analyze intent and generate response
        const intent = this.analyzeIntent(message);
        const response = await this.generateResponse(message, intent);
        
        // Remove typing indicator and show response
        setTimeout(() => {
            this.hideTypingIndicator();
            this.addAdvancedMessage(response);
            this.context.push({ role: 'assistant', content: response.text, timestamp: Date.now() });
            this.userProfile.conversationHistory.push({ 
                message: response.text, 
                sender: 'bot', 
                timestamp: Date.now(),
                type: response.type 
            });
            this.saveUserProfile();
            this.showSuggestions(response.suggestions || []);
        }, 1000 + Math.random() * 1000); // Realistic typing delay
    }

    analyzeIntent(message) {
        const lowerMessage = message.toLowerCase();
        
        const intents = {
            greeting: /hello|hi|hey|greetings|good morning|good afternoon|good evening|welcome/i,
            projects: /project|github|code|repository|build|develop|work|portfolio|speaking|talk|presentation|lecture|event/i,
            research: /research|publication|paper|study|biology|gpcr|molecular|science|academic|scholar/i,
            contact: /contact|email|reach|connect|linkedin|social|message|talk|call|meet/i,
            experience: /experience|job|work|career|professional|company|position|role|prudential|senior|ml engineer/i,
            skills: /skill|technology|tech|programming|language|framework|tool|expertise|ability|proficient/i,
            education: /education|degree|university|college|school|ntse|national talent search|scholarship|award|academic/i,
            speaking: /speaking|talk|presentation|lecture|event|conference|panel|summit|battlefin|ai accelerator|put data first/i,
            entrepreneurship: /startup|entrepreneur|business|venture|synergii|founder|company|innovation/i,
            personal: /who|what|why|how|tell me about|personality|interests|hobby|background|story/i,
            help: /help|what can you do|commands|features|guide|assist/i,
            goodbye: /bye|goodbye|see you|talk later|thanks|thank you|farewell/i
        };

        for (const [intent, pattern] of Object.entries(intents)) {
            if (pattern.test(lowerMessage)) {
                return intent;
            }
        }
        
        return 'general';
    }

    async generateResponse(message, intent) {
        try {
            // Try to use edge LLM API (currently disabled, fallback to simple responses)
            const response = await this.tryEdgeLLM(message, intent);
            if (response) {
                return response;
            }
        } catch (error) {
            console.log('Edge LLM unavailable:', error);
        }
        
        // Fallback response when Gemini is unavailable
        const fallbackResponses = {
            greeting: "Hello! I'm Keshavan's AI assistant. I'm currently using my basic responses while my advanced AI brain (Gemini 2.5 Flash) is being set up. Feel free to explore Keshavan's work or contact him directly at keshavanseshadri@gmail.com!",
                            projects: "I'd love to tell you about Keshavan's amazing projects! He's an accomplished speaker at major AI conferences, and has impressive research tools for GPCR studies. Check out his GitHub for more details!",
            research: "Keshavan's research focuses on computational biology, particularly GPCR mechanisms that are crucial for drug discovery. His work bridges AI and biology in fascinating ways!",
            contact: "You can reach Keshavan at keshavanseshadri@gmail.com. He's always excited to discuss AI projects, research collaborations, or startup opportunities!",
            experience: "Keshavan is a Senior ML Engineer at Prudential Financial, bringing together his Cornell Computer Science background with cutting-edge AI applications in fintech.",
            skills: "Keshavan's expertise spans Machine Learning (TensorFlow, PyTorch), Full-Stack Development, Computational Biology, and Cloud Technologies - a unique combination perfect for AI-driven solutions!",
            education: "Keshavan graduated from Cornell University with a Computer Science degree, where he gained deep knowledge in AI, software engineering, and research methodologies.",
                            achievements: "Recent highlights include speaking at major AI conferences like the AI Accelerator Institute Summit, publishing GPCR research, being an NTSE scholar, and mentoring through Break Through Tech. Quite impressive!",
            general: "I'm using my basic responses while my advanced AI brain is being set up. I'd love to help you learn about Keshavan! Try asking about his projects, speaking engagements, research, or experience, or contact him directly at keshavanseshadri@gmail.com."
        };
        
        const response = {
            text: fallbackResponses[intent] || fallbackResponses.general,
            type: 'text',
            suggestions: this.getContextualSuggestions(intent),
            actions: this.getQuickActions(intent)
        };

        return response;
    }

    async tryEdgeLLM(message, intent) {
        // Google Gemini 2.5 Flash Integration (ENABLED)
        try {
            const response = await this.generateWithGemini(message, intent);
            if (response) {
                return response;
            }
        } catch (error) {
            console.log('Gemini API error:', error);
            // Fall through to maintenance message
        }
        
        // Fallback options (disabled while Gemini is active)
        // Option 1: Browser-based LLM using Transformers.js (client-side)
        // Option 2: OpenAI API
        // Option 3: Hugging Face Inference API
        
        // For now, return null to use maintenance fallback if Gemini fails
        return null;
    }
    
    async loadTransformersJS() {
        // Load Transformers.js for client-side LLM
        if (typeof transformers === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
            script.type = 'module';
            document.head.appendChild(script);
            
            return new Promise((resolve) => {
                script.onload = () => {
                    this.transformersLoaded = true;
                    resolve();
                };
            });
        }
    }
    
    async generateWithGemini(message, intent) {
        // Google Gemini 2.5 Flash integration
        try {
            // Get API key from environment or global variable
            const apiKey = window.GEMINI_API_KEY || process.env.GEMINI_API_KEY || this.getGeminiApiKey();
            
            if (!apiKey) {
                console.log('Gemini API key not found');
                return null;
            }

            const systemPrompt = this.getAdvancedSystemPrompt(intent);
            const conversationContext = this.buildConversationContext(message);
            const prompt = `${systemPrompt}\n\n${conversationContext}\n\nUser: ${message}\nAssistant:`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.8,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 300,
                        candidateCount: 1,
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.log('Gemini API error:', errorData);
                return null;
            }

            const data = await response.json();
            
            if (data.candidates && data.candidates.length > 0 && data.candidates[0].content) {
                let generatedText = data.candidates[0].content.parts[0].text.trim();
                
                // Enhance the response with rich content based on intent
                const enhancedResponse = this.enhanceResponseWithRichContent(generatedText, intent, message);
                
                return enhancedResponse;
            }

            return null;
        } catch (error) {
            console.log('Gemini generation error:', error);
            return null;
        }
    }

    getGeminiApiKey() {
        // Try multiple methods to retrieve the API key
        
        // Method 1: Check if already loaded globally
        if (window.GEMINI_API_KEY && window.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE') {
            return window.GEMINI_API_KEY;
        }
        
        // Method 2: Check environment variables (Node.js)
        if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
            return process.env.GEMINI_API_KEY;
        }
        
        // Method 3: Check if injected during build process
        if (window.GEMINI_API_KEY_INJECTED) {
            return window.GEMINI_API_KEY_INJECTED;
        }
        
        // Method 4: Try to load from localStorage (for development)
        const stored = localStorage.getItem('gemini_api_key');
        if (stored && stored !== 'YOUR_GEMINI_API_KEY_HERE') {
            return stored;
        }
        
        console.log('⚠️ Gemini API key not found - using fallback responses');
        console.log('💡 To enable AI responses, get your free API key from: https://makersuite.google.com/app/apikey');
        return null;
    }

    getAdvancedSystemPrompt(intent) {
        const basePersonality = `You are Keshavan Seshadri's intelligent AI assistant, powered by Google Gemini 2.5 Flash. You're helpful, friendly, professional, and genuinely excited about Keshavan's work and achievements.

Your personality:
- Enthusiastic and knowledgeable about AI, technology, and innovation
- Professional yet approachable, like a knowledgeable colleague
- Confident in discussing Keshavan's accomplishments without being boastful
- Encouraging visitors to connect and learn more
- Brief but comprehensive - provide valuable information concisely`;

        const comprehensiveBackground = `
ABOUT KESHAVAN SESHADRI:

Professional Role:
- Senior ML Engineer at Prudential Financial
- Specializes in cutting-edge fintech AI solutions and ML infrastructure
- Bridges traditional finance with revolutionary AI technologies

Education & Background:
- Cornell University Computer Science graduate
- Strong foundation in algorithms, systems design, and software engineering
- Academic excellence combined with practical industry experience

Research Expertise:
- Computational Biology researcher specializing in GPCR (G-protein coupled receptor) mechanisms
- Published research on protein dynamics and molecular interactions crucial for drug discovery
- Collaborator at IIIT Hyderabad on breakthrough GPCR activation studies
- Combines AI/ML techniques with biological systems research

Recent Major Achievements:
- 🎤 Accomplished speaker at major AI conferences and industry summits
- Spoke at AI Accelerator Institute - Agentic AI Summit NYC (featured panelist)
- Successfully presented at BattleFin Discovery Day on AI & Alternative Data in Finance
- Upcoming speaker at Put Data First Conference
- 🏆 NTSE (National Talent Search Examination) Scholar - prestigious academic honor

Technical Skills & Expertise:
- Machine Learning: TensorFlow, PyTorch, advanced neural architectures
- Full-Stack Development: React, Node.js, Python, cloud platforms
- Cloud Technologies: AWS, GCP, distributed systems, scalable ML pipelines
- Computational Biology: Molecular dynamics, protein modeling, bioinformatics
- Financial Technology: Risk modeling, algorithmic trading, compliance systems

Entrepreneurship & Innovation:
- Founder of Synergii - bridging technology gaps in emerging markets
- Focus on AI-powered solutions for financial inclusion and accessibility
- Vision for democratizing advanced technology globally

Community Impact:
- Break Through Tech mentor - supporting underrepresented groups in tech
- Active contributor to open-source projects
- Passionate about making AI education accessible
- Speaker at tech conferences and academic symposiums

Research Publications:
- "Computational Analysis of GPCR Activation Mechanisms" - breakthrough findings
- Impact on drug discovery and pharmaceutical research
- Citation count growing in scientific community
- Bridge between academic research and practical applications

Contact & Collaboration:
- Email: keshavanseshadri@gmail.com
- LinkedIn: Professional networking and industry connections
- GitHub: Open-source contributions and project showcases
- Always open to discussing AI, research collaborations, startup opportunities`;

        const intentSpecificPrompts = {
            projects: `${basePersonality}\n${comprehensiveBackground}\n\nCURRENT FOCUS: Discuss Keshavan's projects with enthusiasm. Highlight his speaking engagements at major AI conferences, his research tools, GitHub portfolio, and the intersection of his academic and industry work. Show excitement about the technical innovation and real-world impact.`,
            
            research: `${basePersonality}\n${comprehensiveBackground}\n\nCURRENT FOCUS: Enthusiastically explain Keshavan's computational biology research, particularly his GPCR work. Connect it to drug discovery importance, explain how he combines AI with biology, and highlight the academic-industry bridge his research represents.`,
            
            contact: `${basePersonality}\n${comprehensiveBackground}\n\nCURRENT FOCUS: Help visitors connect with Keshavan. Emphasize his openness to collaborations, mentoring spirit, and genuine interest in discussing AI, research, and startup opportunities. Provide clear contact methods and encourage reaching out.`,
            
            experience: `${basePersonality}\n${comprehensiveBackground}\n\nCURRENT FOCUS: Showcase Keshavan's impressive career trajectory from Cornell to Prudential Financial to entrepreneurship. Emphasize his unique position bridging academia, industry, and innovation. Highlight his fintech expertise and leadership qualities.`,
            
            skills: `${basePersonality}\n${comprehensiveBackground}\n\nCURRENT FOCUS: Enthusiastically detail Keshavan's diverse technical skill set. Emphasize the rare combination of ML expertise, computational biology knowledge, and financial technology experience. Show how these skills create unique value.`,
            
            achievements: `${basePersonality}\n${comprehensiveBackground}\n\nCURRENT FOCUS: Celebrate Keshavan's accomplishments with genuine excitement! Focus on his speaking engagements at major AI conferences, NTSE scholarship, research publications, mentoring impact, and the significance of his contributions to both academic and industry communities.`,
            
            entrepreneurship: `${basePersonality}\n${comprehensiveBackground}\n\nCURRENT FOCUS: Discuss Keshavan's entrepreneurial vision with Synergii and his approach to solving real-world problems. Emphasize his commitment to democratizing technology and creating positive global impact through innovation.`,
            
            greeting: `${basePersonality}\n${comprehensiveBackground}\n\nCURRENT FOCUS: Welcome visitors warmly and set an enthusiastic tone. Briefly highlight what makes Keshavan unique - his speaking at major AI conferences, diverse expertise, and openness to collaboration. Encourage exploration of his work.`,
            
            general: `${basePersonality}\n${comprehensiveBackground}\n\nCURRENT FOCUS: Provide helpful, engaging responses about any aspect of Keshavan's work. Show genuine enthusiasm for his diverse accomplishments and encourage deeper exploration of his projects, research, or background.`
        };

        return intentSpecificPrompts[intent] || intentSpecificPrompts.general;
    }

    buildConversationContext(currentMessage) {
        // Build a smart conversation context from recent messages
        const recentMessages = this.context.slice(-4); // Last 4 exchanges
        let context = "";
        
        recentMessages.forEach(msg => {
            if (msg.role === 'user') {
                context += `User: ${msg.content}\n`;
            } else if (msg.role === 'assistant') {
                context += `Assistant: ${msg.content}\n`;
            }
        });
        
        return context;
    }

    enhanceResponseWithRichContent(generatedText, intent, userMessage) {
        // Create enhanced response with potential rich content
        const response = {
            text: generatedText,
            type: 'advanced',
            suggestions: this.getContextualSuggestions(intent),
            actions: this.getQuickActions(intent)
        };

        // Add rich content based on intent
        if (intent === 'speaking' || (intent === 'projects' && (userMessage.toLowerCase().includes('speaking') || userMessage.toLowerCase().includes('talk') || userMessage.toLowerCase().includes('conference')))) {
            response.richContent = {
                type: 'project_spotlight',
                title: '🎤 Speaking Engagements & Conference Presentations',
                items: [
                    {
                        title: 'AI Accelerator Institute Summit NYC',
                        description: 'Panel: Explainability and Transparency in Autonomous Agents',
                        icon: '🗽',
                        status: 'Featured Panelist 2025'
                    },
                    {
                        title: 'BattleFin Discovery Day',
                        description: 'AI & Alternative Data in Finance - Successfully presented',
                        icon: '🏢',
                        status: 'Completed 2025'
                    },
                    {
                        title: 'Put Data First Conference',
                        description: 'Future of Data-Driven Innovation - October 2025',
                        icon: '📊',
                        status: 'Upcoming Speaker'
                    }
                ],
                cta: 'Want to know more about these speaking engagements?'
            };
        } else if (intent === 'skills') {
            response.richContent = {
                type: 'skills_showcase',
                title: '🎯 Technical Expertise Portfolio',
                categories: [
                    {
                        name: 'Machine Learning',
                        level: 'Expert',
                        skills: ['TensorFlow', 'PyTorch', 'Neural Networks', 'Deep Learning', 'MLOps']
                    },
                    {
                        name: 'Computational Biology',
                        level: 'Expert',
                        skills: ['GPCR Research', 'Molecular Dynamics', 'Protein Modeling', 'Bioinformatics']
                    },
                    {
                        name: 'Financial Technology',
                        level: 'Advanced',
                        skills: ['Risk Modeling', 'Algorithmic Systems', 'Compliance Tech', 'Fintech Innovation']
                    },
                    {
                        name: 'Full-Stack Development',
                        level: 'Expert',
                        skills: ['React', 'Node.js', 'Python', 'Cloud Platforms', 'System Design']
                    }
                ]
            };
        } else if (intent === 'contact') {
            response.richContent = {
                type: 'contact_info',
                title: '💬 Connect with Keshavan',
                items: [
                    {
                        platform: 'Email',
                        value: 'keshavanseshadri@gmail.com',
                        icon: '📧',
                        primary: true,
                        description: 'Best for collaborations, opportunities, and detailed discussions'
                    },
                    {
                        platform: 'LinkedIn',
                        value: 'Professional Network',
                        icon: '💼',
                        primary: false,
                        description: 'Industry connections and professional updates'
                    },
                    {
                        platform: 'GitHub',
                        value: 'Open Source',
                        icon: '💻',
                        primary: false,
                        description: 'Code repositories and technical projects'
                    }
                ],
                note: 'Keshavan is always excited to discuss AI, research, startups, and collaboration opportunities!'
            };
        }

        return response;
    }

    getResponsesByIntent(intent, message) {
        const userName = this.userProfile.name || 'there';
        const isReturningUser = this.userProfile.visitCount > 1;
        
        const responses = {
            greeting: [
                `Hello ${userName}! ${isReturningUser ? 'Welcome back! ' : ''}I'm Keshavan's AI assistant. I can help you learn about his work, projects, and research. What would you like to explore?`,
                `Hi ${userName}! ${isReturningUser ? 'Great to see you again! ' : ''}I'm here to help you discover Keshavan's journey in AI, research, and entrepreneurship. How can I assist you?`,
                `Greetings! I'm Keshavan's intelligent assistant. ${isReturningUser ? 'Thanks for coming back! ' : ''}I can provide insights about his projects, experience, and achievements. What interests you most?`
            ],
            projects: [
                "Keshavan has built some amazing projects! His recent work includes speaking at major AI conferences, GPCR research tools, and various AI applications. His GitHub showcases full-stack development, ML models, and research tools. Would you like me to show you specific projects?",
                "From speaking at conferences to publishing research, Keshavan's work spans AI, web development, and computational biology. His portfolio includes research tools, open-source contributions, and speaking engagements at major industry events. I can provide detailed information about any specific project!",
                "Keshavan's project portfolio is impressive! He's built everything from AI chatbots to molecular dynamics simulations. Recent highlights include his speaking engagements at AI conferences and groundbreaking GPCR research. Want to dive deeper into any particular area?"
            ],
            research: [
                "Keshavan's research focuses on computational biology, particularly GPCR (G-protein coupled receptor) activation mechanisms. His work at IIIT Hyderabad has been published and contributes to drug discovery research. He combines AI with biology to understand protein dynamics and molecular interactions.",
                "His research bridges AI and biology! Keshavan studies how proteins work at the molecular level, specifically GPCRs which are crucial for drug development. His publications demonstrate innovative approaches to understanding cellular communication and protein behavior.",
                "Fascinating research! Keshavan explores the intersection of AI and computational biology. His GPCR studies help understand how cells communicate, which is vital for developing new medicines. He uses advanced simulations and ML to decode protein behavior."
            ],
            contact: [
                "Ready to connect with Keshavan? You can reach him at keshavanseshadri@gmail.com. He's also active on LinkedIn and always open to discussing AI, research collaborations, or startup opportunities. Feel free to use the contact form below!",
                "Keshavan loves connecting with fellow innovators! Email him at keshavanseshadri@gmail.com or connect via LinkedIn. He's particularly interested in AI projects, research collaborations, and entrepreneurship discussions.",
                "Want to get in touch? Keshavan is just an email away at keshavanseshadri@gmail.com. He's always excited to discuss cutting-edge AI, potential collaborations, or startup ideas. His LinkedIn is also a great way to connect professionally!"
            ],
            experience: [
                "Keshavan currently works as a Senior ML Engineer at Prudential Financial, focusing on innovative fintech solutions and AI applications. With his Cornell Tech background and research experience, he brings a unique blend of academic rigor and industry expertise to his role.",
                "His professional journey is impressive! At Prudential Financial, Keshavan develops cutting-edge ML solutions for financial services. His experience spans from academic research at top institutions to real-world AI applications in the finance industry.",
                "Keshavan's career combines the best of both worlds - deep research experience and practical industry applications. At Prudential, he's working on next-generation financial technology, leveraging his AI expertise and Cornell education."
            ],
            skills: [
                "Keshavan's skill set is incredibly diverse! He's expert in Machine Learning (TensorFlow, PyTorch), Full-Stack Development (React, Node.js, Python), Computational Biology (molecular dynamics, protein analysis), and Cloud Technologies (AWS, Docker). His unique combination makes him perfect for AI-driven solutions.",
                "His technical arsenal includes advanced AI/ML frameworks, modern web technologies, scientific computing tools, and cloud platforms. From building neural networks to creating web applications to running molecular simulations - Keshavan does it all!",
                "Impressive technical breadth! Keshavan masters everything from deep learning and NLP to full-stack development and bioinformatics. His skills span Python, JavaScript, React, TensorFlow, AWS, and specialized tools for computational research."
            ],
            education: [
                "Keshavan's educational background is stellar! He's an NTSE (National Talent Search Examination) scholar and graduated from Cornell University with a degree in Computer Science, bringing together theoretical knowledge and practical skills. His time at Cornell Tech provided cutting-edge exposure to AI and entrepreneurship.",
                "Cornell University alumnus with a strong foundation in Computer Science! Keshavan's education journey began with being an NTSE scholar - a prestigious national-level academic honor in India. His education at one of the world's top tech programs equipped him with advanced knowledge in AI, software engineering, and research methodologies.",
                "His educational journey is exceptional! Starting as an NTSE scholar, Keshavan went on to Cornell's renowned Computer Science program. This combination of early academic recognition and world-class university education provided him with the foundation to excel in both research and industry applications."
            ],
            achievements: [
                "Keshavan's achievements are remarkable! Recent highlights include speaking at major AI conferences like the AI Accelerator Institute Summit and BattleFin Discovery Day, being an NTSE scholar, publishing research on GPCR mechanisms, and mentoring students through Break Through Tech. He has an upcoming presentation at Put Data First Conference and has contributed to open-source projects.",
                "So many accomplishments to celebrate! From successful conference presentations to research publications to community impact through mentoring. Keshavan's achievements span technical innovation, academic contribution, and social impact in the tech community.",
                "His achievement list keeps growing! NTSE scholar, accomplished conference speaker who has presented at major industry events, published researcher, open-source contributor, and tech mentor. Keshavan exemplifies excellence across multiple dimensions of the tech world."
            ],
            personal: [
                "Keshavan is a passionate builder, researcher, and entrepreneur at heart! He loves working at the intersection of AI and real-world applications, whether that's in finance, biology, or emerging technologies. His curiosity drives him to explore new frontiers in tech and science.",
                "He's someone who genuinely cares about using technology to make a positive impact! Keshavan combines technical excellence with entrepreneurial thinking, always looking for ways to solve meaningful problems through innovation.",
                "Keshavan embodies the spirit of a modern tech innovator - curious, driven, and impact-focused. He's equally comfortable diving deep into research or building practical solutions that help people and businesses."
            ],
            help: [
                "I can help you explore Keshavan's world! Ask me about his projects, research, work experience, technical skills, education, achievements, or how to contact him. I can also provide specific details about his publications, GitHub repositories, or career journey. What would you like to know?",
                "I'm here to be your guide through Keshavan's professional journey! I can discuss his AI research, development projects, career highlights, technical expertise, or educational background. I can also help you connect with him or learn about specific aspects of his work.",
                "Think of me as your personal tour guide to Keshavan's career and achievements! I can provide insights about his research publications, development projects, professional experience, or technical skills. Just ask about anything you're curious about!"
            ],
            goodbye: [
                "Thanks for chatting with me! Feel free to explore Keshavan's portfolio and don't hesitate to reach out if you'd like to connect. Have a wonderful day!",
                "It was great talking with you! I hope you found our conversation helpful. Remember, Keshavan is always open to interesting discussions and collaborations. Take care!",
                "Goodbye for now! I enjoyed helping you learn about Keshavan. Feel free to come back anytime with more questions, and don't forget to check out his latest projects!"
            ],
            general: [
                "That's an interesting question! I'd love to help you learn more about Keshavan. You can ask me about his projects, research, professional experience, technical skills, achievements, or how to contact him. What would you like to explore?",
                "I'm here to help you discover more about Keshavan's work and background! Try asking about his AI projects, research publications, career at Prudential, technical expertise, or recent achievements. What interests you most?",
                "Great question! I can provide insights about many aspects of Keshavan's journey - from his award-winning projects to his cutting-edge research, from his professional experience to his technical skills. What would you like to dive into?"
            ]
        };

        return responses[intent] || responses.general;
    }

    getContextualSuggestions(intent) {
        const suggestionMap = {
            greeting: ["🎤 Tell me about his speaking engagements", "💼 What's his experience?", "📧 How can I contact him?"],
            projects: ["🔬 Show me his research", "🎯 What are his skills?", "🏅 Tell me about achievements"],
            research: ["💻 What projects has he built?", "📚 What's his background?", "🤝 How to collaborate?"],
            contact: ["🚀 What are his projects?", "⚡ Tell me about his skills", "💼 What's his experience?"],
            experience: ["🏗️ Show me his projects", "🔬 What about his research?", "🎯 What skills does he have?"],
            skills: ["💻 What projects use these skills?", "📈 Tell me about his experience", "📞 How to contact him?"],
            education: ["🏆 What has he built?", "💼 Tell me about his work", "🏅 Show me achievements"],
            achievements: ["🚀 What projects is he proud of?", "📱 How can I contact him?", "📖 What's his background?"],
            entrepreneurship: ["💡 Tell me about Synergii", "🤝 How to get involved?", "🌟 What's his vision?"],
            help: ["🏆 Tell me about projects", "💼 Show me his experience", "📧 How to contact him?"]
        };

        return suggestionMap[intent] || suggestionMap.greeting;
    }

    getQuickActions(intent) {
        const actionMap = {
            projects: ["View GitHub", "Learn about speaking engagements", "Explore research tools"],
            research: ["Read publications", "Understand GPCR work", "Academic collaborations"],
            contact: ["Send email", "Connect on LinkedIn", "Schedule meeting"],
            experience: ["View resume", "Learn about Prudential", "Career journey"],
            skills: ["Technical overview", "Skill assessment", "Project examples"],
            achievements: ["Hackathon details", "Award information", "Recognition timeline"],
            entrepreneurship: ["About Synergii", "Startup vision", "Investment opportunities"]
        };

        return actionMap[intent] || ["Learn more", "Get in touch", "Explore projects"];
    }

    getProjectsRichContent() {
        return {
            title: "🚀 Featured Projects & Speaking",
            items: [
                {
                    name: "AI Conference Speaking",
                    description: "Major AI conferences and industry summits",
                    tech: ["AI", "Autonomous Agents", "Data Innovation"],
                    status: "🎤 Active Speaker"
                },
                {
                    name: "GPCR Research Tools",
                    description: "Computational biology research platform",
                    tech: ["Python", "Molecular Dynamics", "Machine Learning"],
                    status: "📚 Published"
                },
                {
                    name: "Portfolio Website",
                    description: "Interactive personal portfolio with AI chatbot",
                    tech: ["JavaScript", "CSS", "AI Integration"],
                    status: "🌐 Live"
                }
            ],
            cta: { text: "View All Projects", action: "github" }
        };
    }

    getContactRichContent() {
        return {
            title: "📬 Get in Touch",
            items: [
                {
                    platform: "Email",
                    value: "keshavanseshadri@gmail.com",
                    icon: "📧",
                    action: "email"
                },
                {
                    platform: "LinkedIn",
                    value: "Connect professionally",
                    icon: "💼",
                    action: "linkedin"
                },
                {
                    platform: "GitHub",
                    value: "Explore repositories",
                    icon: "🔗",
                    action: "github"
                }
            ],
            cta: { text: "Use Contact Form", action: "contact_form" }
        };
    }

    getSkillsRichContent() {
        return {
            title: "🛠️ Technical Expertise",
            categories: [
                {
                    name: "AI & Machine Learning",
                    skills: ["TensorFlow", "PyTorch", "NLP", "Computer Vision", "LLMs"],
                    level: "Expert"
                },
                {
                    name: "Full-Stack Development",
                    skills: ["React", "Node.js", "Python", "JavaScript", "TypeScript"],
                    level: "Expert"
                },
                {
                    name: "Computational Biology",
                    skills: ["Molecular Dynamics", "Protein Analysis", "Bioinformatics"],
                    level: "Advanced"
                },
                {
                    name: "Cloud & DevOps",
                    skills: ["AWS", "Docker", "CI/CD", "Kubernetes"],
                    level: "Proficient"
                }
            ]
        };
    }

    showWelcomeMessage() {
        if (this.userProfile.visitCount === 1) {
            setTimeout(() => {
                this.addMessage("🚀 Welcome! I'm Keshavan's AI assistant, powered by Google Gemini 2.5 Flash. I'm thrilled to help you discover his incredible journey - from being an NTSE scholar to speaking at major AI conferences to his groundbreaking research and fintech innovations! What would you like to explore?", 'bot');
                this.showSuggestions(["🎤 Tell me about his speaking engagements", "🔬 What's his research about?", "💼 How can I contact him?"]);
            }, 500);
        } else {
            setTimeout(() => {
                this.addMessage(`🎉 Welcome back! This is your ${this.userProfile.visitCount}${this.getOrdinalSuffix(this.userProfile.visitCount)} visit. I'm here with the latest Gemini 2.5 Flash AI to dive deeper into Keshavan's amazing work. What interests you most today?`, 'bot');
                this.showSuggestions(["🆕 Latest achievements", "💡 Research breakthroughs", "🤝 Collaboration opportunities"]);
            }, 500);
        }
    }

    getOrdinalSuffix(num) {
        const suffixes = ["th", "st", "nd", "rd"];
        const value = num % 100;
        return suffixes[(value - 20) % 10] || suffixes[value] || suffixes[0];
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chatbot-messages');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chatbot-message bot typing-indicator';
        typingDiv.id = 'typing-indicator';
        typingDiv.innerHTML = `
            <div class="typing-animation">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        this.isTyping = true;
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
        this.isTyping = false;
    }

    addMessage(text, sender) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `chatbot-message ${sender}`;
        messageDiv.innerHTML = `<p>${text}</p>`;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        if (sender === 'bot') {
            this.speakMessage(text);
        }
        
        this.trackEvent('message_sent', { sender, message_length: text.length });
    }

    addAdvancedMessage(response) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'chatbot-message bot advanced';
        
        // Create the main message content
        const messageContent = document.createElement('p');
        messageContent.textContent = response.text;
        messageDiv.appendChild(messageContent);
        
        // Add rich content if available
        if (response.richContent) {
            const richDiv = this.createRichContent(response.richContent);
            messageDiv.appendChild(richDiv);
        }
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    createRichContent(richContent) {
        const container = document.createElement('div');
        container.className = 'rich-content';
        
        if (richContent.title) {
            const title = document.createElement('h4');
            title.textContent = richContent.title;
            container.appendChild(title);
        }
        
        if (richContent.type === 'project_spotlight') {
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'rich-items';
            
            richContent.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'rich-item project-item';
                
                const header = document.createElement('div');
                header.className = 'item-header';
                
                const titleSpan = document.createElement('h5');
                titleSpan.textContent = `${item.icon} ${item.title}`;
                
                const status = document.createElement('span');
                status.className = 'status';
                status.textContent = item.status;
                
                header.appendChild(titleSpan);
                header.appendChild(status);
                
                const description = document.createElement('p');
                description.textContent = item.description;
                
                itemDiv.appendChild(header);
                itemDiv.appendChild(description);
                itemsContainer.appendChild(itemDiv);
            });
            
            container.appendChild(itemsContainer);
            
            if (richContent.cta) {
                const cta = document.createElement('button');
                cta.className = 'rich-cta';
                cta.textContent = richContent.cta;
                cta.onclick = () => this.handleQuickAction('projects_detailed');
                container.appendChild(cta);
            }
        } else if (richContent.type === 'skills_showcase') {
            const categoriesDiv = document.createElement('div');
            categoriesDiv.className = 'skill-categories';
            
            richContent.categories.forEach(category => {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'skill-category';
                
                const header = document.createElement('div');
                header.className = 'category-header';
                
                const name = document.createElement('h5');
                name.textContent = category.name;
                
                const level = document.createElement('span');
                level.className = `skill-level ${category.level.toLowerCase()}`;
                level.textContent = category.level;
                
                header.appendChild(name);
                header.appendChild(level);
                
                const skillsDiv = document.createElement('div');
                skillsDiv.className = 'skill-tags';
                
                category.skills.forEach(skill => {
                    const skillTag = document.createElement('span');
                    skillTag.className = 'skill-tag';
                    skillTag.textContent = skill;
                    skillsDiv.appendChild(skillTag);
                });
                
                categoryDiv.appendChild(header);
                categoryDiv.appendChild(skillsDiv);
                categoriesDiv.appendChild(categoryDiv);
            });
            
            container.appendChild(categoriesDiv);
        } else if (richContent.type === 'contact_info') {
            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'rich-items';
            
            richContent.items.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = `rich-item contact-item ${item.primary ? 'primary' : ''}`;
                
                const iconSpan = document.createElement('span');
                iconSpan.className = 'contact-icon';
                iconSpan.textContent = item.icon;
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'contact-info';
                
                const platform = document.createElement('strong');
                platform.textContent = item.platform;
                
                const value = document.createElement('span');
                value.textContent = item.value;
                
                const description = document.createElement('span');
                description.textContent = item.description;
                description.style.fontSize = '0.9rem';
                description.style.opacity = '0.8';
                
                infoDiv.appendChild(platform);
                infoDiv.appendChild(value);
                infoDiv.appendChild(description);
                
                itemDiv.appendChild(iconSpan);
                itemDiv.appendChild(infoDiv);
                itemsContainer.appendChild(itemDiv);
            });
            
            container.appendChild(itemsContainer);
            
            if (richContent.note) {
                const note = document.createElement('p');
                note.style.fontStyle = 'italic';
                note.style.marginTop = '1rem';
                note.style.opacity = '0.9';
                note.textContent = richContent.note;
                container.appendChild(note);
            }
        }
        
        return container;
    }

    handleQuickAction(action) {
        const actionMap = {
            'projects_detailed': "Tell me more about his projects in detail",
            'speaking_details': "What conferences has he spoken at?",
            'research_publications': "Show me his research publications",
            'contact_email': "How can I reach him via email?",
            'skills_technical': "What are his technical specializations?",
            'achievements_timeline': "What are his major career achievements?"
        };
        
        const message = actionMap[action] || "Tell me more about that";
        this.simulateUserInput(message);
    }
    
    simulateUserInput(message) {
        const input = document.getElementById('chatbot-input');
        input.value = message;
        this.sendMessage();
    }

    showSuggestions(suggestions) {
        this.clearSuggestions();
        if (suggestions.length === 0) return;
        
        const messagesContainer = document.getElementById('chatbot-messages');
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'suggestions-container';
        suggestionsDiv.id = 'suggestions-container';
        
        let html = '<div class="suggestions">';
        suggestions.forEach(suggestion => {
            html += `<button class="suggestion-chip" onclick="chatbot.selectSuggestion('${suggestion}')">${suggestion}</button>`;
        });
        html += '</div>';
        
        suggestionsDiv.innerHTML = html;
        messagesContainer.appendChild(suggestionsDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    clearSuggestions() {
        const suggestions = document.getElementById('suggestions-container');
        if (suggestions) {
            suggestions.remove();
        }
    }

    selectSuggestion(suggestion) {
        document.getElementById('chatbot-input').value = suggestion;
        this.sendMessage();
    }

    speakMessage(text) {
        if ('speechSynthesis' in window && this.userProfile.voiceEnabled !== false) {
            // Clean text for speech
            const cleanText = text.replace(/[📧💼🔗🚀📚🌐🏆📬🛠️👋🎉]/g, '').trim();
            if (cleanText.length > 0 && cleanText.length < 200) { // Only speak shorter messages
                const utterance = new SpeechSynthesisUtterance(cleanText);
                utterance.rate = 0.9;
                utterance.pitch = 1;
                utterance.volume = 0.7;
                speechSynthesis.speak(utterance);
            }
        }
    }

    startVoiceInput() {
        if (this.recognition) {
            this.recognition.start();
            this.trackEvent('voice_input_started');
        }
    }

    trackEvent(eventName, properties = {}) {
        // Analytics tracking
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, properties);
        }
        
        // Local storage for analytics
        const events = JSON.parse(localStorage.getItem('chatbot_events') || '[]');
        events.push({
            event: eventName,
            properties,
            timestamp: Date.now()
        });
        
        // Keep only last 100 events
        if (events.length > 100) {
            events.splice(0, events.length - 100);
        }
        
        localStorage.setItem('chatbot_events', JSON.stringify(events));
    }

    saveUserProfile() {
        localStorage.setItem('chatbot_history', JSON.stringify(this.userProfile.conversationHistory));
    }
}

// Initialize the advanced chatbot
const chatbot = new AdvancedChatbot();

// Legacy function compatibility
function toggleChatbot() {
    chatbot.toggleChatbot();
}

function sendMessage() {
    chatbot.sendMessage();
}

// Handle Enter key in chatbot
document.getElementById('chatbot-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Handle quick actions and rich content interactions
document.addEventListener('click', function(e) {
    if (e.target.closest('.quick-action') || e.target.closest('.rich-cta') || e.target.closest('.contact-item')) {
        const action = e.target.closest('[data-action]')?.getAttribute('data-action');
        if (action) {
            chatbot.handleQuickAction(action);
        }
    }
});

// Enhanced chatbot notification
function showChatbotNotification() {
    const notification = document.getElementById('chatbot-notification');
    if (notification) {
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 3000);
    }
}

// Show notification periodically
setInterval(() => {
    if (!chatbot.isOpen && Math.random() < 0.3) {
        showChatbotNotification();
    }
}, 30000); // Every 30 seconds

// Contact form handling
document.querySelector('.contact-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const email = formData.get('email');
    const message = formData.get('message');
    
    // In production, you'd send this to a backend service
    // For now, we'll use mailto as a fallback
    const mailtoLink = `mailto:keshavanseshadri@gmail.com?subject=Contact from ${name}&body=${message}%0D%0A%0D%0AFrom: ${email}`;
    window.location.href = mailtoLink;
    
    // Reset form
    e.target.reset();
    alert('Thank you for your message! I will get back to you soon.');
});

// Add form field names
document.querySelector('.contact-form input[type="text"]').setAttribute('name', 'name');
document.querySelector('.contact-form input[type="email"]').setAttribute('name', 'email');
document.querySelector('.contact-form textarea').setAttribute('name', 'message');

// Navbar scroll effect
let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > lastScrollTop) {
        navbar.style.transform = 'translateY(-100%)';
    } else {
        navbar.style.transform = 'translateY(0)';
    }
    
    lastScrollTop = scrollTop;
});

// Load news and events
function loadNews() {
    let newsData = [];
    
    if (typeof websiteData !== 'undefined' && websiteData.news) {
        newsData = websiteData.news;
    }
    
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = '';
    
    newsData.forEach((item, index) => {
        const newsItem = createNewsItem(item, index);
        newsContainer.appendChild(newsItem);
    });
}

function createNewsItem(item, index) {
    const div = document.createElement('div');
    div.className = 'news-item';
    div.setAttribute('data-aos', 'fade-up');
    div.setAttribute('data-aos-delay', index * 100);
    
    const typeIcon = {
        'speaking': 'fa-microphone',
        'achievement': 'fa-trophy',
        'volunteer': 'fa-hands-helping',
        'default': 'fa-newspaper'
    };
    
    const icon = typeIcon[item.type] || typeIcon.default;
    
    div.innerHTML = `
        <div class="news-header">
            <div class="news-date">${item.date}</div>
            <i class="fas ${icon} news-icon"></i>
        </div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
        ${item.link ? `<a href="${item.link}" target="_blank" class="news-link">Learn More <i class="fas fa-arrow-right"></i></a>` : ''}
    `;
    
    return div;
}

// Load education data
function loadEducation() {
    let educationData = [];
    
    if (typeof websiteData !== 'undefined' && websiteData.education) {
        educationData = websiteData.education;
    }
    
    const educationContainer = document.getElementById('education-container');
    educationContainer.innerHTML = '';
    
    educationData.forEach((item, index) => {
        const educationCard = createEducationCard(item, index);
        educationContainer.appendChild(educationCard);
    });
}

function createEducationCard(item, index) {
    const card = document.createElement('div');
    card.className = 'education-card';
    card.setAttribute('data-aos', 'fade-up');
    card.setAttribute('data-aos-delay', index * 100);
    
    const iconClass = item.type === 'bachelors' ? 'fa-university' : 
                     item.type === 'masters' ? 'fa-graduation-cap' : 'fa-flask';
    
    card.innerHTML = `
        <div class="education-icon">
            <i class="fas ${iconClass}"></i>
        </div>
        <div class="education-content">
            <h3>${item.institution}</h3>
            <p class="education-degree">${item.degree}</p>
            <p class="education-program">${item.program}</p>
        </div>
    `;
    
    return card;
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchGitHubProjects();
    fetchPublications();
    loadTimeline();
    loadEducation();
    loadNews();
    
    // Refresh data every 30 minutes
    setInterval(() => {
        fetchGitHubProjects();
        fetchPublications();
        loadNews();
    }, 1800000);
});

// Add typing animation to hero title
const heroTitle = document.querySelector('.hero-title');
const originalText = heroTitle.innerHTML;
heroTitle.innerHTML = '';

function typeWriter(element, text, i = 0) {
    if (i < text.length) {
        element.innerHTML = text.slice(0, i + 1);
        setTimeout(() => typeWriter(element, text, i + 1), 50);
    }
}

// Start typing animation after page load
window.addEventListener('load', () => {
    setTimeout(() => {
        typeWriter(heroTitle, originalText);
    }, 500);
});

// Add parallax effect to hero section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallax = document.querySelector('.hero');
    parallax.style.transform = `translateY(${scrolled * 0.5}px)`;
});

// Function to toggle abstract display
function toggleAbstract(event, link) {
    event.preventDefault();
    const abstractContainer = link.parentElement;
    const truncated = abstractContainer.querySelector('.abstract-truncated');
    const full = abstractContainer.querySelector('.abstract-full');
    
    if (full.style.display === 'none') {
        truncated.style.display = 'none';
        full.style.display = 'inline';
        link.textContent = 'Read less';
    } else {
        truncated.style.display = 'inline';
        full.style.display = 'none';
        link.textContent = 'Read more';
    }
}

// Binary Matrix Animation with "You are beautiful" message
const binaryCanvas = document.getElementById('binary-canvas');
const binaryCtx = binaryCanvas.getContext('2d');

// Make canvas full screen
binaryCanvas.width = window.innerWidth;
binaryCanvas.height = window.innerHeight;

// Convert "You are beautiful" to binary
function textToBinary(text) {
    return text.split('').map(char => {
        return char.charCodeAt(0).toString(2).padStart(8, '0');
    }).join(' ');
}

const secretMessage = "You are beautiful";
const binaryMessage = textToBinary(secretMessage);
const binaryChars = '01';
const financeChars = '$€£¥₹';
const aiChars = 'AI∞∑∏∫≈≠';

// Matrix settings
const fontSize = 14;
const columns = Math.floor(binaryCanvas.width / fontSize);

// Array to store the y position of each column
const drops = [];
for (let i = 0; i < columns; i++) {
    drops[i] = Math.random() * -100;
}

// Special message display
let messageDisplayTimer = 0;
let showingMessage = false;
let messageOpacity = 0;

// Draw the matrix
function drawMatrix() {
    // Add translucent black to create fade effect
    binaryCtx.fillStyle = 'rgba(10, 10, 20, 0.05)';
    binaryCtx.fillRect(0, 0, binaryCanvas.width, binaryCanvas.height);
    
    // Set text properties
    binaryCtx.font = fontSize + 'px monospace';
    
    // Draw falling characters
    for (let i = 0; i < drops.length; i++) {
        let char;
        let color;
        
        // Determine character type and color
        const rand = Math.random();
        if (rand > 0.95) {
            char = financeChars[Math.floor(Math.random() * financeChars.length)];
            color = '#10b981'; // Green for finance
        } else if (rand > 0.92) {
            char = aiChars[Math.floor(Math.random() * aiChars.length)];
            color = '#3b82f6'; // Blue for AI
        } else {
            char = binaryChars[Math.floor(Math.random() * binaryChars.length)];
            color = '#6366f1'; // Default purple
        }
        
        // Add some glow effect to random characters
        if (Math.random() > 0.98) {
            binaryCtx.shadowColor = color;
            binaryCtx.shadowBlur = 10;
        } else {
            binaryCtx.shadowBlur = 0;
        }
        
        binaryCtx.fillStyle = color;
        binaryCtx.fillText(char, i * fontSize, drops[i] * fontSize);
        
        // Move drop down
        if (drops[i] * fontSize > binaryCanvas.height && Math.random() > 0.975) {
            drops[i] = 0;
        }
        drops[i]++;
    }
    
    // Display "You are beautiful" message periodically
    messageDisplayTimer++;
    if (messageDisplayTimer > 300) { // Show message every ~10 seconds
        showingMessage = true;
        messageDisplayTimer = 0;
    }
    
    if (showingMessage) {
        messageOpacity += 0.02;
        if (messageOpacity >= 1) {
            messageOpacity = 1;
            setTimeout(() => {
                showingMessage = false;
                messageOpacity = 0;
            }, 3000); // Show for 3 seconds
        }
        
        // Display the binary message
        binaryCtx.shadowBlur = 20;
        binaryCtx.shadowColor = '#a855f7';
        binaryCtx.fillStyle = `rgba(168, 85, 247, ${messageOpacity})`;
        binaryCtx.font = '16px monospace';
        
        const centerX = binaryCanvas.width / 2;
        const centerY = binaryCanvas.height / 2;
        
        // Display "You are beautiful" in regular text
        binaryCtx.textAlign = 'center';
        binaryCtx.fillText(secretMessage, centerX, centerY - 20);
        
        // Display the binary equivalent below
        binaryCtx.font = '12px monospace';
        binaryCtx.fillStyle = `rgba(99, 102, 241, ${messageOpacity * 0.8})`;
        binaryCtx.fillText(binaryMessage, centerX, centerY + 10);
        
        // Reset text alignment and font
        binaryCtx.textAlign = 'left';
        binaryCtx.font = fontSize + 'px monospace';
        binaryCtx.shadowBlur = 0;
    }
}

// Animate the matrix
setInterval(drawMatrix, 50);

// Resize canvas on window resize
window.addEventListener('resize', () => {
    binaryCanvas.width = window.innerWidth;
    binaryCanvas.height = window.innerHeight;
    
    // Recalculate columns
    const newColumns = Math.floor(binaryCanvas.width / fontSize);
    if (newColumns !== columns) {
        // Adjust drops array
        drops.length = newColumns;
        for (let i = columns; i < newColumns; i++) {
            drops[i] = Math.random() * -100;
        }
    }
}); 