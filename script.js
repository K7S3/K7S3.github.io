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
            greeting: /hello|hi|hey|greetings|good morning|good afternoon|good evening/i,
            projects: /project|github|code|repository|build|develop|work|portfolio/i,
            research: /research|publication|paper|gpcr|biology|science|study|academic/i,
            contact: /contact|email|reach|connect|hire|collaborate|meet/i,
            experience: /experience|work|job|career|prudential|company|role/i,
            skills: /skill|technology|tech|programming|language|framework|tool/i,
            education: /education|university|cornell|degree|study|school|learn/i,
            achievements: /achievement|award|hackathon|win|accomplishment|prize|recognition/i,
            personal: /who|what|why|how|tell me about|personality|interests|hobby/i,
            help: /help|what can you do|commands|features|guide/i,
            goodbye: /bye|goodbye|see you|talk later|thanks|thank you/i
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
            greeting: "Hello! I'm having a brief connection issue with my AI brain. While I get that sorted, feel free to explore Keshavan's work or contact him directly at keshavanseshadri@gmail.com!",
            projects: "I'd love to tell you about Keshavan's amazing projects! He recently won the AI Berkeley Hackathon 2025 Grand Prize with ChipChat, and has impressive research tools for GPCR studies. Check out his GitHub for more details!",
            research: "Keshavan's research focuses on computational biology, particularly GPCR mechanisms that are crucial for drug discovery. His work bridges AI and biology in fascinating ways!",
            contact: "You can reach Keshavan at keshavanseshadri@gmail.com. He's always excited to discuss AI projects, research collaborations, or startup opportunities!",
            experience: "Keshavan is a Senior ML Engineer at Prudential Financial, bringing together his Cornell Computer Science background with cutting-edge AI applications in fintech.",
            skills: "Keshavan's expertise spans Machine Learning (TensorFlow, PyTorch), Full-Stack Development, Computational Biology, and Cloud Technologies - a unique combination perfect for AI-driven solutions!",
            education: "Keshavan graduated from Cornell University with a Computer Science degree, where he gained deep knowledge in AI, software engineering, and research methodologies.",
            achievements: "Recent highlights include winning the AI Berkeley Hackathon 2025 Grand Prize, publishing GPCR research, and mentoring through Break Through Tech. Quite impressive!",
            general: "I'm having a brief connection issue, but I'd love to help you learn about Keshavan! Try asking about his projects, research, or experience, or contact him directly at keshavanseshadri@gmail.com."
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

            const systemPrompt = this.getSystemPrompt(intent);
            const prompt = `${systemPrompt}\n\nUser: ${message}\nAssistant:`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
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
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 200,
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
                const generatedText = data.candidates[0].content.parts[0].text.trim();
                
                return {
                    text: generatedText,
                    type: 'text',
                    suggestions: this.getContextualSuggestions(intent),
                    actions: this.getQuickActions(intent)
                };
            }

            return null;
        } catch (error) {
            console.log('Gemini generation error:', error);
            return null;
        }
    }

    getGeminiApiKey() {
        // This method can be customized to retrieve the API key securely
        // For development, you can temporarily set it here
        // For production, use GitHub secrets or environment variables
        return null; // Will be set via GitHub Actions or environment
    }

    getSystemPrompt(intent) {
        const basePrompt = `You are Keshavan Seshadri's AI assistant. You help visitors learn about his professional background, projects, and achievements.

About Keshavan:
- Senior ML Engineer at Prudential Financial, working on innovative fintech solutions
- Cornell University Computer Science graduate
- Researcher in computational biology, specifically GPCR (G-protein coupled receptor) mechanisms
- AI Berkeley Hackathon 2025 Grand Prize winner with ChipChat
- Published researcher with work on protein dynamics and molecular interactions
- Mentor through Break Through Tech
- Expert in Machine Learning (TensorFlow, PyTorch), Full-Stack Development, and Cloud Technologies

Guidelines:
- Keep responses concise (1-3 sentences) and friendly
- Focus on his professional work, research, and achievements
- Direct users to contact him at keshavanseshadri@gmail.com for collaborations
- Be helpful and informative about his background and projects`;

        const intentSpecificPrompts = {
            projects: `${basePrompt}\n\nFocus on: His award-winning ChipChat project, GPCR research tools, GitHub repositories, and AI applications.`,
            research: `${basePrompt}\n\nFocus on: His computational biology research, GPCR studies, publications, and intersection of AI with biology.`,
            contact: `${basePrompt}\n\nFocus on: How to reach him for collaborations, his email, LinkedIn, and professional interests.`,
            experience: `${basePrompt}\n\nFocus on: His role at Prudential Financial, Cornell education, and career journey.`,
            skills: `${basePrompt}\n\nFocus on: His technical expertise in ML, full-stack development, computational biology, and cloud technologies.`,
            education: `${basePrompt}\n\nFocus on: His Cornell Computer Science degree and educational background.`,
            achievements: `${basePrompt}\n\nFocus on: AI Berkeley Hackathon win, research publications, mentoring work, and career highlights.`
        };

        return intentSpecificPrompts[intent] || basePrompt;
    }

    async generateWithTransformers(message) {
        // Client-side text generation using Transformers.js (legacy fallback)
        try {
            return null; // Disabled in favor of Gemini
        } catch (error) {
            console.log('Client-side generation error:', error);
            return null;
        }
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
                "Keshavan has built some amazing projects! His recent work includes ChipChat (AI Berkeley Hackathon Grand Prize winner), GPCR research tools, and various AI applications. His GitHub showcases full-stack development, ML models, and research tools. Would you like me to show you specific projects?",
                "From winning hackathons to publishing research, Keshavan's projects span AI, web development, and computational biology. His portfolio includes award-winning applications, research tools, and open-source contributions. I can provide detailed information about any specific project!",
                "Keshavan's project portfolio is impressive! He's built everything from AI chatbots to molecular dynamics simulations. Recent highlights include his hackathon-winning ChipChat and groundbreaking GPCR research. Want to dive deeper into any particular area?"
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
                "Keshavan's educational background is stellar! He graduated from Cornell University with a degree in Computer Science, bringing together theoretical knowledge and practical skills. His time at Cornell Tech provided cutting-edge exposure to AI and entrepreneurship.",
                "Cornell University alumnus with a strong foundation in Computer Science! Keshavan's education at one of the world's top tech programs equipped him with advanced knowledge in AI, software engineering, and research methodologies.",
                "His Cornell education provides an exceptional foundation! The Computer Science program there is renowned for its rigor and innovation. Keshavan leveraged this world-class education to excel in both research and industry applications."
            ],
            achievements: [
                "Keshavan's achievements are remarkable! Recent highlights include winning the Grand Prize at AI Berkeley Hackathon 2025 with ChipChat, publishing research on GPCR mechanisms, and mentoring students through Break Through Tech. He's also contributed to open-source projects and spoken at tech events.",
                "So many accomplishments to celebrate! From hackathon victories to research publications to community impact through mentoring. Keshavan's achievements span technical innovation, academic contribution, and social impact in the tech community.",
                "His achievement list keeps growing! AI Berkeley Hackathon Grand Prize winner, published researcher, open-source contributor, and tech mentor. Keshavan exemplifies excellence across multiple dimensions of the tech world."
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
            greeting: ["Tell me about his projects", "What's his experience?", "How can I contact him?"],
            projects: ["Show me his research", "What about his skills?", "Tell me about achievements"],
            research: ["What projects has he built?", "What's his background?", "How to collaborate?"],
            contact: ["What are his projects?", "Tell me about his skills", "What's his experience?"],
            experience: ["Show me his projects", "What about his research?", "What skills does he have?"],
            skills: ["What projects use these skills?", "Tell me about his experience", "How to contact him?"],
            education: ["What has he built?", "Tell me about his work", "Show me achievements"],
            achievements: ["What projects is he proud of?", "How can I contact him?", "What's his background?"],
            help: ["Tell me about projects", "Show me his experience", "How to contact him?"]
        };

        return suggestionMap[intent] || suggestionMap.greeting;
    }

    getQuickActions(intent) {
        const actionMap = {
            contact: [
                { text: "📧 Send Email", action: "email" },
                { text: "💼 LinkedIn", action: "linkedin" },
                { text: "📋 Contact Form", action: "contact_form" }
            ],
            projects: [
                { text: "🔗 View GitHub", action: "github" },
                { text: "🏆 See Achievements", action: "achievements" },
                { text: "💡 Latest Projects", action: "latest_projects" }
            ],
            research: [
                { text: "📚 Publications", action: "publications" },
                { text: "🔬 Research Details", action: "research" },
                { text: "🎓 Education", action: "education" }
            ]
        };

        return actionMap[intent] || [];
    }

    getProjectsRichContent() {
        return {
            title: "🚀 Featured Projects",
            items: [
                {
                    name: "ChipChat",
                    description: "AI Berkeley Hackathon 2025 Grand Prize Winner",
                    tech: ["AI", "NLP", "Web Development"],
                    status: "🏆 Award Winner"
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
                this.addMessage("👋 Welcome! I'm Keshavan's AI assistant, powered by Google Gemini 2.5 Flash. I can help you learn about his projects, research, experience, and more. What would you like to know?", 'bot');
                this.showSuggestions(["Tell me about his projects", "What's his experience?", "How can I contact him?"]);
            }, 500);
        } else {
            setTimeout(() => {
                this.addMessage(`🎉 Welcome back! This is your ${this.userProfile.visitCount}${this.getOrdinalSuffix(this.userProfile.visitCount)} visit. I'm here to help you explore Keshavan's work and achievements. What interests you today?`, 'bot');
                this.showSuggestions(["Latest projects", "Research work", "Contact information"]);
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
        messageDiv.className = `chatbot-message bot advanced`;
        
        let content = `<p>${response.text}</p>`;
        
        // Add rich content if available
        if (response.type === 'rich' && response.richContent) {
            content += this.renderRichContent(response.richContent);
        }
        
        // Add quick actions
        if (response.actions && response.actions.length > 0) {
            content += this.renderQuickActions(response.actions);
        }
        
        messageDiv.innerHTML = content;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        this.speakMessage(response.text);
        this.trackEvent('advanced_message_sent', { type: response.type });
    }

    renderRichContent(richContent) {
        if (!richContent) return '';
        
        let html = `<div class="rich-content">`;
        html += `<h4>${richContent.title}</h4>`;
        
        if (richContent.items) {
            html += `<div class="rich-items">`;
            richContent.items.forEach(item => {
                if (item.name) {
                    // Project-style item
                    html += `
                        <div class="rich-item project-item">
                            <div class="item-header">
                                <h5>${item.name}</h5>
                                <span class="status">${item.status}</span>
                            </div>
                            <p>${item.description}</p>
                            <div class="tech-tags">
                                ${item.tech.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                            </div>
                        </div>
                    `;
                } else if (item.platform) {
                    // Contact-style item
                    html += `
                        <div class="rich-item contact-item" data-action="${item.action}">
                            <span class="contact-icon">${item.icon}</span>
                            <div class="contact-info">
                                <strong>${item.platform}</strong>
                                <span>${item.value}</span>
                            </div>
                        </div>
                    `;
                }
            });
            html += `</div>`;
        }
        
        if (richContent.categories) {
            // Skills-style content
            html += `<div class="skill-categories">`;
            richContent.categories.forEach(category => {
                html += `
                    <div class="skill-category">
                        <div class="category-header">
                            <h5>${category.name}</h5>
                            <span class="skill-level ${category.level.toLowerCase()}">${category.level}</span>
                        </div>
                        <div class="skill-tags">
                            ${category.skills.map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        if (richContent.cta) {
            html += `<button class="rich-cta" data-action="${richContent.cta.action}">${richContent.cta.text}</button>`;
        }
        
        html += `</div>`;
        return html;
    }

    renderQuickActions(actions) {
        let html = `<div class="quick-actions">`;
        actions.forEach(action => {
            html += `<button class="quick-action" data-action="${action.action}">${action.text}</button>`;
        });
        html += `</div>`;
        return html;
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

    handleQuickAction(action) {
        const actions = {
            email: () => window.open('mailto:keshavanseshadri@gmail.com'),
            linkedin: () => window.open('https://www.linkedin.com/in/keshavan-seshadri/', '_blank'),
            github: () => window.open('https://github.com/K7S3', '_blank'),
            contact_form: () => document.getElementById('contact').scrollIntoView({ behavior: 'smooth' }),
            achievements: () => this.selectSuggestion("Tell me about his achievements"),
            latest_projects: () => this.selectSuggestion("What are his latest projects?"),
            publications: () => document.getElementById('publications').scrollIntoView({ behavior: 'smooth' }),
            research: () => document.getElementById('about').scrollIntoView({ behavior: 'smooth' }),
            education: () => document.getElementById('education').scrollIntoView({ behavior: 'smooth' })
        };

        if (actions[action]) {
            actions[action]();
            this.trackEvent('quick_action_clicked', { action });
        }
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