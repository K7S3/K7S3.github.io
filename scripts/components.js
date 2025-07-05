// Component Loader System
class ComponentLoader {
    constructor() {
        this.components = {};
        this.loadedComponents = new Set();
    }

    // Load a component from the components directory
    async loadComponent(componentName) {
        if (this.loadedComponents.has(componentName)) {
            return this.components[componentName];
        }

        try {
            const response = await fetch(`components/${componentName}.html`);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${componentName}`);
            }
            
            const html = await response.text();
            this.components[componentName] = html;
            this.loadedComponents.add(componentName);
            
            return html;
        } catch (error) {
            console.error(`Error loading component ${componentName}:`, error);
            return null;
        }
    }

    // Insert component into a target element
    async insertComponent(targetSelector, componentName) {
        const target = document.querySelector(targetSelector);
        if (!target) {
            console.error(`Target element not found: ${targetSelector}`);
            return;
        }

        const componentHTML = await this.loadComponent(componentName);
        if (componentHTML) {
            target.innerHTML = componentHTML;
        }
    }

    // Load and insert multiple components
    async loadComponents(componentMap) {
        const promises = Object.entries(componentMap).map(([selector, componentName]) => 
            this.insertComponent(selector, componentName)
        );
        
        await Promise.all(promises);
    }

    // Load component-specific CSS
    loadComponentStyles(componentName) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `styles/${componentName}.css`;
        link.onload = () => console.log(`Loaded styles for ${componentName}`);
        link.onerror = () => console.warn(`Failed to load styles for ${componentName}`);
        document.head.appendChild(link);
    }

    // Load component-specific JavaScript
    async loadComponentScript(componentName) {
        try {
            const script = document.createElement('script');
            script.src = `scripts/${componentName}.js`;
            script.onload = () => console.log(`Loaded script for ${componentName}`);
            script.onerror = () => console.warn(`Failed to load script for ${componentName}`);
            document.head.appendChild(script);
        } catch (error) {
            console.warn(`Error loading script for ${componentName}:`, error);
        }
    }

    // Initialize navbar functionality
    initializeNavbar() {
        // Navbar scroll effect
        window.addEventListener('scroll', () => {
            const navbar = document.querySelector('.navbar');
            if (navbar) {
                if (window.scrollY > 50) {
                    navbar.classList.add('scrolled');
                } else {
                    navbar.classList.remove('scrolled');
                }
            }
        });

        // Mobile menu toggle
        const navToggle = document.querySelector('.nav-toggle');
        const navMenu = document.querySelector('.nav-menu');
        const navMobileMenu = document.querySelector('.nav-mobile-menu');
        
        if (navToggle) {
            navToggle.addEventListener('click', () => {
                navToggle.classList.toggle('active');
                if (navMobileMenu) {
                    navMobileMenu.classList.toggle('active');
                }
                
                // Prevent body scroll when mobile menu is open
                document.body.style.overflow = navMobileMenu?.classList.contains('active') ? 'hidden' : 'auto';
            });
        }

        // Close mobile menu when clicking on a link
        const mobileLinks = document.querySelectorAll('.nav-mobile-menu .nav-link');
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                navToggle?.classList.remove('active');
                navMobileMenu?.classList.remove('active');
                document.body.style.overflow = 'auto';
            });
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!navToggle?.contains(e.target) && !navMobileMenu?.contains(e.target)) {
                navToggle?.classList.remove('active');
                navMobileMenu?.classList.remove('active');
                document.body.style.overflow = 'auto';
            }
        });

        // Smooth scrolling for navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href.startsWith('#')) {
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }
            });
        });

        // Update active link based on scroll position
        window.addEventListener('scroll', () => {
            const sections = document.querySelectorAll('section[id]');
            const scrollPos = window.scrollY + 100;
            
            sections.forEach(section => {
                const sectionTop = section.offsetTop;
                const sectionHeight = section.offsetHeight;
                const sectionId = section.getAttribute('id');
                
                if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                    document.querySelectorAll('.nav-link').forEach(link => {
                        link.classList.remove('active');
                        if (link.getAttribute('href') === `#${sectionId}`) {
                            link.classList.add('active');
                        }
                    });
                }
            });
        });
    }

    // Initialize all components
    async initializeComponents() {
        const componentMap = {
            '#header-container': 'header',
            '#hero-container': 'hero',
            '#about-container': 'about',
            '#timeline-container': 'timeline',
            '#education-container': 'education',
            '#entrepreneurship-container': 'entrepreneurship',
            '#publications-container': 'publications',
            '#projects-container': 'projects',
            '#speaking-container': 'speaking',
            '#news-container': 'news',
            '#contact-container': 'contact',
            '#footer-container': 'footer',
            '#chatbot-container': 'chatbot'
        };

        // Load base styles first
        this.loadComponentStyles('base');

        // Load all components
        await this.loadComponents(componentMap);

        // Load component-specific styles
        Object.values(componentMap).forEach(componentName => {
            this.loadComponentStyles(componentName);
        });

        // Initialize AOS animations after components are loaded
        if (typeof AOS !== 'undefined') {
            AOS.refresh();
        }

        // Initialize navbar functionality
        this.initializeNavbar();

        // Trigger custom event when all components are loaded
        document.dispatchEvent(new CustomEvent('componentsLoaded'));
    }
}

// Initialize the component loader
const componentLoader = new ComponentLoader();

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    componentLoader.initializeComponents();
}); 