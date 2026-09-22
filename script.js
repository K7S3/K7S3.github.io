// Hide loader when page is loaded
window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hidden');
    }, 1000);
});

// Honor the user's reduced-motion preference across all animations
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Throttle scroll-driven work to one run per animation frame
function throttleRaf(fn) {
    let ticking = false;
    return function(...args) {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            fn.apply(this, args);
            ticking = false;
        });
    };
}

// Escape text for safe insertion into innerHTML templates
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Initialize AOS (skip entirely when the user prefers reduced motion)
if (!prefersReducedMotion) {
    AOS.init({
        duration: 1000,
        once: true,
        offset: 100
    });
}

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
        navToggle.setAttribute('aria-expanded', navMobileMenu.classList.contains('active'));
    });

    // Close mobile menu when clicking on a link
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (navMobileMenu.classList.contains('active')) {
                navToggle.classList.remove('active');
                navMobileMenu.classList.remove('active');
                document.body.style.overflow = 'auto';
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!navToggle.contains(e.target) && !navMobileMenu.contains(e.target)) {
            navToggle.classList.remove('active');
            navMobileMenu.classList.remove('active');
            document.body.style.overflow = 'auto';
            navToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Keyboard navigation for mobile menu
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && navMobileMenu.classList.contains('active')) {
            navToggle.classList.remove('active');
            navMobileMenu.classList.remove('active');
            document.body.style.overflow = 'auto';
            navToggle.setAttribute('aria-expanded', 'false');
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

    // Navbar scroll effect and active link highlighting (throttled via rAF)
    window.addEventListener('scroll', throttleRaf(function() {
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
    }));

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
    
    // Add parallax effect to hero image (throttled; skipped for reduced motion)
    window.addEventListener('scroll', throttleRaf(function() {
        if (prefersReducedMotion) return;
        const scrolled = window.pageYOffset;
        const parallax = document.querySelector('.hero-image');
        if (parallax) {
            const speed = scrolled * 0.5;
            parallax.style.transform = `translateY(${speed}px)`;
        }
    }));
    
    // Add typing animation to hero title (skip for reduced motion).
    // Types into the existing markup so the gradient name span survives.
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle && !prefersReducedMotion) {
        const greeting = "Hi, I'm ";
        const name = "Keshavan Seshadri";
        heroTitle.setAttribute('aria-label', greeting + name);
        heroTitle.innerHTML = '';
        let gi = 0, ni = 0;
        const renderName = () =>
            heroTitle.innerHTML =
                escapeHtml(greeting) +
                '<span class="hero-name gradient-text">' +
                escapeHtml(name.slice(0, ni)) + '</span>';
        const typeWriter = () => {
            if (gi < greeting.length) {
                heroTitle.textContent = greeting.slice(0, ++gi);
                setTimeout(typeWriter, 80);
            } else if (ni <= name.length) {
                renderName();
                ni++;
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
    card.dataset.projectName = project.name;
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
});

// Add form field names
document.querySelector('.contact-form input[type="text"]').setAttribute('name', 'name');
document.querySelector('.contact-form input[type="email"]').setAttribute('name', 'email');
document.querySelector('.contact-form textarea').setAttribute('name', 'message');

// Navbar hide-on-scroll + hero parallax (single throttled handler, reduced-motion aware)
let lastScrollTop = 0;
const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', throttleRaf(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    if (scrollTop > lastScrollTop) {
        navbar.style.transform = 'translateY(-100%)';
    } else {
        navbar.style.transform = 'translateY(0)';
    }

    lastScrollTop = scrollTop;

    if (!prefersReducedMotion) {
        const heroSection = document.querySelector('.hero');
        if (heroSection) {
            heroSection.style.transform = `translateY(${scrollTop * 0.5}px)`;
        }
    }
}));

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
    initStatCounters();

    // Refresh data every 30 minutes
    setInterval(() => {
        fetchGitHubProjects();
        fetchPublications();
    }, 1800000);
});

// Stat count-up animation driven by IntersectionObserver
function initStatCounters() {
    const counters = document.querySelectorAll('.stat-number');
    if (!counters.length) return;

    const renderFinal = (el) => {
        el.textContent = (el.dataset.prefix || '') +
            Number(el.dataset.target).toLocaleString() +
            (el.dataset.suffix || '');
    };

    const animate = (el) => {
        if (prefersReducedMotion) { renderFinal(el); return; }
        const target = Number(el.dataset.target);
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const duration = 1200;
        const start = performance.now();
        const step = (now) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = prefix + Math.round(target * eased).toLocaleString() + suffix;
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                animate(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.4 });

    counters.forEach((el) => {
        // Start at zero so the count-up is visible; reduced-motion users get the final value on intersect
        el.textContent = (el.dataset.prefix || '') + '0' + (el.dataset.suffix || '');
        observer.observe(el);
    });
}

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

// Animate the matrix (desktop only; skipped when the user prefers reduced motion)
const matrixEnabled = !prefersReducedMotion && window.innerWidth >= 768;
if (matrixEnabled) {
    setInterval(drawMatrix, 50);
} else {
    binaryCanvas.style.display = 'none';
}

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