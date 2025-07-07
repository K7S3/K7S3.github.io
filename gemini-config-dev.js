// Development configuration for Gemini API
// IMPORTANT: This file is for local development only!
// Never commit your actual API key to version control

// For local testing, this will try to load from environment variables
// You can get a Gemini API key from: https://makersuite.google.com/app/apikey

// Try to load from environment first
let apiKey = null;

// Method 1: Check if running in Node.js environment
if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    apiKey = process.env.GEMINI_API_KEY;
    console.log('✅ Gemini API key loaded from environment');
}

// Method 2: Check if it's available in the global scope (injected by build process)
if (!apiKey && typeof window !== 'undefined' && window.GEMINI_API_KEY_INJECTED) {
    apiKey = window.GEMINI_API_KEY_INJECTED;
    console.log('✅ Gemini API key loaded from build injection');
}

// Method 3: For local development, you can temporarily set it here
// REMOVE THIS BEFORE COMMITTING TO VERSION CONTROL
if (!apiKey) {
    // Try to get from environment variable in the browser (if available)
    // REPLACE 'YOUR_GEMINI_API_KEY_HERE' WITH YOUR ACTUAL API KEY FOR LOCAL TESTING
    apiKey = 'AIzaSyDnN0ilYtJuXW0M2lM7JZ9vnNoHTnnyQBw'; // Replace with your actual API key for local testing
    
    if (apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        console.log('⚠️  Please replace YOUR_GEMINI_API_KEY_HERE with your actual Gemini API key');
        console.log('📝  Get your free API key from: https://makersuite.google.com/app/apikey');
        apiKey = null; // Set to null so fallback responses are used
    } else {
        console.log('✅ Using local development API key');
    }
}

// Set the global API key
window.GEMINI_API_KEY = apiKey;

// Log status
if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
    console.log('🚀 Gemini API configured successfully');
} else {
    console.log('❌ Gemini API key not configured - chatbot will use fallback responses');
}

console.log('Gemini development config loaded'); 