# પળી ગ્રામ પંચાયત — CBDC રેશન પોર્ટલ
## Website for Central Bank Digital Currency (CBDC) Ration Onboarding Whitelist

A mobile-first, static website designed for **પળી ગ્રામ પંચાયત** (Pali Gram Panchayat, Unjha Taluka, Mehsana District, Gujarat) to inform citizens about the RBI Central Bank Digital Currency (e₹) pilot project for ration distribution, and to lookup eligibility status.

---

## 🚀 Key Features

1. **મુખ્ય પાનું (Home):** Welcome banner, quick action tiles, and a **Quick Eligibility Search Card** pre-filling filters.
2. **પાત્ર યાદી (Beneficiary Whitelist):** Grouped household view indexing family members under a single card block, case-insensitive search by name or ration card number, gold text-highlighting, and lazy loading (15 households per page).
3. **CBDC કરવાના સ્ટેપ (Process):** Side-by-side alternating process step images (`assets/images/steps/step1.jpg` to `step8.jpg`) and description text, plus a responsive embedded YouTube video guide.
4. **માહિતી (More Info):** A simple, scrollable informational layout answering FAQs and describing the 6-step government process flow.

---

## 📁 Folder Structure

```
CBDC/
├── assets/                       # Public static assets
│   ├── css/
│   │   └── style.css             # Stylesheet
│   ├── js/
│   │   └── app.js                # Core JavaScript controller logic
│   ├── data/
│   │   └── data.json             # Compiled static database
│   └── images/
│       ├── logo_web.png          # Header brand logo
│       ├── Logo.png              # Primary logo mark
│       └── steps/                # Onboarding guide screenshots (step1.jpg - step8.jpg)
├── docs/                         # Documentation & raw source files
│   ├── pdfs/                     # PDF guidelines
│   ├── raw_data/                 # Original Excel data sources
│   └── design/                   # UI design drafts
├── archive/                      # Historical / non-production data
├── index.html                    # Main website application entry point
├── vercel.json                   # Vercel deployment headers & configuration
├── .gitignore                    # Git ignore file
└── README.md                     # Project overview & documentation
```

---

## 🛠️ Technology Stack

- **Frontend:** HTML5, CSS3 (variables, transitions, custom HSL palette), Vanilla Javascript (`assets/js/app.js`).
- **Database:** `assets/data/data.json` (compiled static database containing whitelist beneficiaries and generation metadata).
- **Icons:** SVG vector graphics.
- **Typography:** Google Fonts (`Outfit` for numerical listings, `Noto Sans Gujarati` for Gujarati text).

---

## 💻 Local Development

You can run this project locally using any simple HTTP static server.

### Using Python:
1. Open terminal in the directory:
   ```bash
   python -m http.server 8000
   ```
2. Open your browser and navigate to:
   [http://localhost:8000](http://localhost:8000)

---

## ⚡ Vercel Deployment

This is a static site with no build steps, making it incredibly easy to host on Vercel.

1. Push this repository to GitHub.
2. Go to [vercel.com](https://vercel.com) and sign in.
3. Click **"New Project"** and import the GitHub repository.
4. Vercel will automatically detect the static project. You do **not** need to configure any build or output commands.
5. Click **"Deploy"**. The site will build instantly and provide a public URL.

*Subsequent pushes to the `main` branch on GitHub will automatically trigger a re-deployment on Vercel.*
