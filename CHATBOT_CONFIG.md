# Chatbot Configuration Guide

## Current Status
✅ **ACTIVE**: The chatbot is now **powered by Google Gemini 2.5 Flash** and fully operational!

## Chatbot Position
✅ **COMPLETED**: Moved chatbot icon and container to **top right corner** of the screen.

## Gemini 2.5 Flash Integration

The chatbot is now integrated with Google's Gemini 2.5 Flash model for intelligent, context-aware responses about your work and achievements.

### Features
- **Smart Context Understanding**: Knows about your projects, research, and experience
- **Intent Recognition**: Responds appropriately to different types of questions
- **Fallback Responses**: Provides helpful information even when API is unavailable
- **Voice Support**: Includes speech recognition and text-to-speech
- **Mobile Responsive**: Works perfectly on all device sizes

### Production Deployment (GitHub Pages)
✅ **AUTOMATED**: The site now deploys automatically with API key injection via GitHub Actions.

**Setup Process:**
1. ✅ GitHub secret `GEMINI_API_KEY` is configured
2. ✅ GitHub Actions workflow (`.github/workflows/deploy.yml`) handles secure API key injection
3. ✅ Automatic deployment to GitHub Pages with every push to main branch

### Local Development Setup

For local testing and development:

1. **Get a Gemini API Key**:
   - Visit: https://makersuite.google.com/app/apikey
   - Create a new API key

2. **Local Testing Options**:

   **Option A: Environment Variable**
   ```bash
   export GEMINI_API_KEY="your_actual_api_key_here"
   python3 -m http.server 8080
   ```

   **Option B: Development Config File**
   ```bash
   # Copy the development template
   cp gemini-config-dev.js gemini-config-local.js
   
   # Edit gemini-config-local.js and replace YOUR_GEMINI_API_KEY_HERE
   # Add script tag to index.html for local testing:
   # <script src="gemini-config-local.js"></script>
   ```

### Testing the Chatbot

1. **Open the website** (locally: http://localhost:8080)
2. **Click the chatbot icon** in the **top right corner**
3. **Try these test prompts**:
   - "Tell me about Keshavan's projects"
   - "What's his research about?"
   - "How can I contact him?"
   - "What are his technical skills?"

### Expected Behavior

**✅ When Gemini API is working:**
- Intelligent, contextual responses about your work
- Personalized suggestions based on conversation topic
- Natural, conversational tone

**✅ When Gemini API is unavailable:**
- Falls back to helpful pre-written responses
- Still provides accurate information about your background
- Directs users to contact you directly

### Monitoring and Maintenance

**API Usage:**
- Monitor your Gemini API usage in Google AI Studio
- Current rate limits: 15 requests per minute (free tier)
- Each conversation message = 1 API request

**Logs:**
- Check browser console for any API errors
- GitHub Actions logs show deployment status

### Security Features

✅ **API Key Protection**:
- Never stored in source code
- Injected securely via GitHub Actions
- Not accessible in development files (gitignored)

✅ **Content Safety**:
- Gemini's built-in safety filters enabled
- Blocks harmful/inappropriate content
- Professional, work-focused responses

### Customization

To modify the chatbot's knowledge or behavior, edit the `getSystemPrompt()` method in `script.js`. This contains all the information about your background, projects, and achievements that Gemini uses to generate responses.

### Troubleshooting

**If chatbot shows fallback responses:**
1. Check if `GEMINI_API_KEY` GitHub secret is set correctly
2. Verify the GitHub Actions deployment completed successfully
3. Check browser console for API errors

**For local development issues:**
1. Ensure API key is set correctly in environment or config file
2. Check browser console for error messages
3. Verify you're running the local server correctly 