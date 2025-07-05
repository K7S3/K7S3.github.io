# Photo Guide for Your Portfolio Website

## 📸 Photo Requirements and Placement

### 1. Profile Photo
**File name:** `profile-photo.jpg`  
**Location:** Root directory (`/`)  
**Requirements:**
- Square aspect ratio (1:1)
- Minimum 400x400 pixels
- Professional headshot
- High quality JPG

### 2. Panel Discussion Photos
Place these in the root directory:

**AI Accelerator Institute Panel:**
- **File name:** `panel-photo-1.jpg`
- **Event:** Agentic AI Summit NYC
- **Recommended:** Photo of you speaking or panel group shot

**BattleFin Panel:**
- **File name:** `panel-photo-2.jpg`
- **Event:** BattleFin Discovery Day
- **Recommended:** Speaking or networking photo

**Put Data First Panel:**
- **File name:** `panel-photo-3.jpg`
- **Event:** Put Data First Conference
- **Recommended:** Panel discussion photo

**Photo specs:**
- Landscape orientation (16:9 preferred)
- Minimum 800x450 pixels
- Clear, well-lit photos

### 3. Instagram Photos
You have two options:

#### Option A: Direct File Upload (Recommended)
Create an `images` folder in root directory and add:
- `instagram-1.jpg`
- `instagram-2.jpg`
- `instagram-3.jpg`
- `instagram-4.jpg`
- `instagram-5.jpg`
- `instagram-6.jpg`

Then update the Instagram section in `index.html`:
```html
<img src="images/instagram-1.jpg" alt="Instagram post">
```

#### Option B: Use External URLs
Replace the placeholder URLs in the Instagram section with actual URLs from your Instagram posts.

**Photo selection tips:**
- Mix of professional and personal
- Show your personality
- Conference photos
- Project work
- Team photos
- Travel/lifestyle

### 4. Project Screenshots (Optional)
For better project presentation, add:
- `images/synergii-screenshot.png` - Synergii platform screenshot
- `images/3dmol-demo.png` - 3Dmol.js demo
- Add more as needed

### 5. Research/Publication Images
The publication images are already linked from the journal websites, but you can add local copies:
- `images/gpcr-research.jpg`
- `images/allosteric-model.jpg`

## 📁 Final Directory Structure
```
keshavanseshadri.github.io/
├── profile-photo.jpg
├── panel-photo-1.jpg
├── panel-photo-2.jpg
├── panel-photo-3.jpg
├── resume.pdf
├── images/
│   ├── instagram-1.jpg
│   ├── instagram-2.jpg
│   ├── instagram-3.jpg
│   ├── instagram-4.jpg
│   ├── instagram-5.jpg
│   ├── instagram-6.jpg
│   ├── synergii-screenshot.png
│   └── [other project images]
└── [other files]
```

## 🎨 Image Optimization Tips
1. Use JPG for photos, PNG for screenshots
2. Compress images using tools like TinyPNG
3. Keep file sizes under 500KB for fast loading
4. Use descriptive alt text for accessibility

## 🚀 Quick Steps
1. Create `images` folder: `mkdir images`
2. Add all photos to appropriate locations
3. Update HTML if using local Instagram images
4. Test locally before pushing
5. Commit and push to GitHub

Your website will look amazing with all these personal touches! 