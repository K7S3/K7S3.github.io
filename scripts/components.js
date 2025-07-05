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