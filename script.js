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
    
    card.innerHTML = `
        <h3>${pub.title}</h3>
        <p class="publication-authors">${pub.authors}</p>
        <p class="publication-venue">${pub.venue} - ${pub.year}</p>
        <p class="publication-abstract">${pub.abstract}</p>
        <div class="publication-links">
            <a href="${pub.url || pub.link}" target="_blank" class="publication-link">Read More</a>
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

// Chatbot functionality
function toggleChatbot() {
    const chatbot = document.getElementById('chatbot');
    chatbot.classList.toggle('active');
}

function sendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();
    
    if (message) {
        addMessage(message, 'user');
        input.value = '';
        
        // Simulate bot response
        setTimeout(() => {
            const response = getBotResponse(message);
            addMessage(response, 'bot');
        }, 1000);
    }
}

function addMessage(text, sender) {
    const messagesContainer = document.getElementById('chatbot-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `chatbot-message ${sender}`;
    messageDiv.innerHTML = `<p>${text}</p>`;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function getBotResponse(message) {
    const lowerMessage = message.toLowerCase();
    
    // Enhanced chatbot with more responses
    const responses = {
        greeting: [
            "Hello! I'm Keshavan's AI assistant. I can help you learn more about his work, projects, and research. What would you like to know?",
            "Hi there! Welcome to Keshavan's portfolio. How can I assist you today?",
            "Greetings! I'm here to help you explore Keshavan's journey in tech and research. What interests you?"
        ],
        projects: [
            "Keshavan has worked on various projects including AI research, web applications, and computational biology. You can check out his GitHub profile for the latest projects!",
            "His recent projects include ChipChat (AI Berkeley Hackathon winner), GPCR research, and various open-source contributions. Would you like to know more about any specific project?"
        ],
        research: [
            "Keshavan's research focuses on computational biology, particularly GPCR activation mechanisms. His work has been published at IIIT Hyderabad. Check the Publications section for more details!",
            "His research explores the intersection of AI and biology, with a focus on protein dynamics and drug interactions. The GPCR study is his most notable publication."
        ],
        contact: [
            "You can reach Keshavan at keshavanseshadri@gmail.com. Feel free to use the contact form below or connect on LinkedIn!",
            "The best way to contact Keshavan is via email at keshavanseshadri@gmail.com or through his social media profiles linked on this page."
        ],
        experience: [
            "Keshavan currently works at Prudential Financial on innovative fintech solutions. He's also a Cornell University alumnus and mentors students through Break Through Tech.",
            "With experience at Prudential Financial and a CS degree from Cornell, Keshavan brings expertise in both industry and academia."
        ],
        skills: [
            "Keshavan specializes in Machine Learning, Computational Biology, Full-Stack Development, and Entrepreneurship. He's proficient in Python, React, Node.js, and cloud technologies.",
            "His technical stack includes Python, JavaScript, React, Node.js, TensorFlow, and various cloud platforms. He's also skilled in molecular dynamics simulations."
        ],
        education: [
            "Keshavan graduated from Cornell University with a degree in Computer Science. He also has research experience from IIIT Hyderabad.",
            "His educational journey includes Cornell University for CS and significant research contributions at IIIT Hyderabad."
        ],
        achievements: [
            "Recent achievements include winning the Grand Prize at AI Berkeley Hackathon 2025 with ChipChat, publishing research on GPCRs, and mentoring students through Break Through Tech.",
            "Keshavan has won hackathons, published academic research, and actively contributes to the tech community through mentoring."
        ]
    };
    
    // Check for keywords and return appropriate response
    if (lowerMessage.match(/hello|hi|hey|greetings/)) {
        return responses.greeting[Math.floor(Math.random() * responses.greeting.length)];
    } else if (lowerMessage.match(/project|github|code|repository/)) {
        return responses.projects[Math.floor(Math.random() * responses.projects.length)];
    } else if (lowerMessage.match(/research|publication|paper|gpcr|biology/)) {
        return responses.research[Math.floor(Math.random() * responses.research.length)];
    } else if (lowerMessage.match(/contact|email|reach|connect/)) {
        return responses.contact[Math.floor(Math.random() * responses.contact.length)];
    } else if (lowerMessage.match(/experience|work|job|prudential|career/)) {
        return responses.experience[Math.floor(Math.random() * responses.experience.length)];
    } else if (lowerMessage.match(/skill|technology|language|framework|tool/)) {
        return responses.skills[Math.floor(Math.random() * responses.skills.length)];
    } else if (lowerMessage.match(/education|university|cornell|degree|study/)) {
        return responses.education[Math.floor(Math.random() * responses.education.length)];
    } else if (lowerMessage.match(/achievement|award|hackathon|win|accomplishment/)) {
        return responses.achievements[Math.floor(Math.random() * responses.achievements.length)];
    } else if (lowerMessage.match(/thank|thanks|bye|goodbye/)) {
        return "You're welcome! Feel free to reach out if you have any more questions. Have a great day!";
    } else {
        const defaultResponses = [
            "I'd be happy to help! You can ask me about Keshavan's projects, research, experience, skills, or how to contact him. What would you like to know?",
            "That's an interesting question! Try asking about Keshavan's projects, research, education, or professional experience.",
            "I'm here to help you learn more about Keshavan. Feel free to ask about his work, achievements, or how to get in touch!"
        ];
        return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
    }
}

// Handle Enter key in chatbot
document.getElementById('chatbot-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

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

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    fetchGitHubProjects();
    fetchPublications();
    loadTimeline();
    
    // Refresh data every 30 minutes
    setInterval(() => {
        fetchGitHubProjects();
        fetchPublications();
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