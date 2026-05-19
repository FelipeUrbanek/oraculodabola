# Design System: Integrated Oráculo Ecosystem

A unified design-as-code system powering high-fidelity Instagram visual rendering.

---

## 🎨 Color Tokens (OKLCH & Palette Strategy)

### Shared Neutrals
- **Primary Background:** `oklch(15% 0.01 240)` - Deep charcoal tint, avoiding flat `#000`.
- **Secondary (Borders & Glass):** `oklch(100% 0.00 0 / 10%)` - 10% pure white opacity for realistic glass borders.

### ⚽ Football Accents
- **Primary Green:** `oklch(75% 0.25 145)` - High-chroma Electric Pitch Green.

### 🎬 Cinema & Séries Accents
- **Pop Orange:** `#FF5E00` / `oklch(62% 0.28 28)` - High-chroma cinematic pop.
- **Cyber Cyan:** `#00F0FF` / `oklch(80% 0.16 195)` - Futuristic sci-fi neon.
- **Royal Purple:** `#9D00FF` / `oklch(45% 0.31 300)` - Artsy, high-prestige stream aura.
- **Classic Red:** `#E50914` / `oklch(53% 0.22 25)` - High-impact Netflix-style breaking news.

---

## font-bebas 🔠 Typography Engine

| Font Class | Font Family | Esthetic Lane | Typical Use Case |
|---|---|---|---|
| `.font-bebas` | `'Bebas Neue', cursive` | Bold, condensed, tall | Action, Thrillers, Breaking News |
| `.font-cinzel` | `'Cinzel', serif` | Prestigious, historical | Epic movies, historical drama |
| `.font-playfair`| `'Playfair Display', serif`| High-prestige, elegant, italic | Deep critic reviews, indie awards |
| `.font-space` | `'Space Grotesk', sans` | Tech-heavy, futuristic | Sci-Fi, technology, cyberpunk |
| `.font-syne` | `'Syne', sans-serif` | Avant-garde, wide, modern | Experimental film, trending shows |
| `.font-montserrat`| `'Montserrat', sans` | Geometric, sturdy pop | Standard breaking pop news |

---

## 📐 Component Specs

### 1. Feed Card (4:5 Aspect Ratio)
- **Canvas Size:** `1080 x 1350px`
- **Branding Header:** Custom inline bar `"EC | @espectadorcomum"` in cinema or `"ORÁCULO | @ooraculodabola"` in football.
- **Readability Gradients:** Bottom-up high-contrast dark overlay (`linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 75%, #000 100%)`) to ensure scraped movie/football backgrounds never conflict with text.

### 2. Story Card (9:16 Aspect Ratio)
- **Canvas Size:** `1080 x 1920px`
- **Layout Flow:** Vertical asymmetry. Large headline aligned in the top/middle third, content summary container placed in the bottom third to leverage mobile phone readability naturally.
- **Borders:** Thin elegant borders matching the active layout preset.
