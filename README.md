# Keshavan Seshadri - Personal Portfolio Website

A beautiful, interactive personal portfolio website with automatic data updates from GitHub, Google Scholar, and LinkedIn.

🌐 **Live Demo**: [https://keshavanseshadri.github.io](https://keshavanseshadri.github.io)

## ✨ Features

- **Modern Design**: Beautiful dark theme with gradient accents and smooth animations
- **Interactive Elements**: 
  - Particle.js background effects
  - Smooth scrolling navigation
  - AOS (Animate On Scroll) animations
  - Parallax effects
- **AI Chatbot**: Interactive assistant to answer questions about Keshavan's work
- **Auto-updating Content**:
  - GitHub projects fetched via API
  - Publications from Google Scholar
  - Timeline from LinkedIn profile
- **Responsive Design**: Works perfectly on all devices
- **Contact Form**: Easy way to get in touch
- **Social Media Integration**: Links to all social profiles

## 🚀 Quick Start

1. Fork this repository
2. Enable GitHub Pages in your repository settings
3. Update the content in `update_data.py` with your information
4. The site will be live at `https://keshavanseshadri.github.io`

## 📁 Project Structure

```
├── index.html          # Main HTML file
├── styles.css          # All styling
├── script.js           # Interactive features and API calls
├── data.js            # Auto-generated data file
├── update_data.py     # Python script to fetch latest data
├── requirements.txt   # Python dependencies
├── .github/
│   └── workflows/
│       └── update-data.yml  # GitHub Action for auto-updates
└── README.md
```

## 🔧 Customization

### Personal Information
Edit the following files to customize the content:

1. **index.html**: Update name, title, and static content
2. **update_data.py**: Modify the data fetching functions
3. **script.js**: Adjust chatbot responses and interactions

### Styling
- Colors and themes can be changed in `styles.css` (CSS variables)
- Animations and effects are also in `styles.css`

### Auto-update Configuration
The GitHub Action runs every 6 hours to update:
- GitHub projects
- Google Scholar publications  
- LinkedIn timeline

## 🛠️ Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Libraries**: 
  - Particles.js for background effects
  - AOS for scroll animations
  - Font Awesome for icons
- **Backend**: Python for data fetching
- **Deployment**: GitHub Pages
- **CI/CD**: GitHub Actions

## 📱 Features in Detail

### Interactive Chatbot
- AI-powered responses about projects, skills, and experience
- Natural language processing for better interaction
- Contextual responses based on user queries

### Dynamic Content Loading
- Projects automatically fetched from GitHub API
- Publications can be updated via Google Scholar
- Timeline reflects latest career updates

### Beautiful Animations
- Particle effects in background
- Smooth scroll animations
- Hover effects on cards
- Typing animation for hero text

## 🔄 Automatic Updates

The website automatically updates its content using GitHub Actions:

1. **GitHub Projects**: Fetches latest repositories every 6 hours
2. **Publications**: Updates from Google Scholar (requires manual update in current version)
3. **Timeline**: Syncs with LinkedIn data (requires manual update in current version)

To manually trigger an update:
1. Go to Actions tab in your GitHub repository
2. Select "Update Website Data"
3. Click "Run workflow"

## 📧 Contact

- Email: keshavanseshadri@gmail.com
- LinkedIn: [Keshavan Seshadri](https://www.linkedin.com/in/keshavan-seshadri/)
- GitHub: [K7S3](https://github.com/K7S3)

## 📄 License

This project is open source and available under the MIT License.

---

Built with ❤️ by Keshavan Seshadri
