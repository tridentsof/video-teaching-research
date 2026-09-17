# Coding Standards & Guidelines

## 1. Bilingual Support (English & Vietnamese)
- **Mandatory Dual-Language**: All UI features, user-facing copy, export reports (Word, PDF, Markdown, HTML), dashboards, and interactive views MUST support bilingualism (English and Vietnamese).
- **No Hardcoded Strings**: Avoid hardcoding single-language text strings directly in UI components or export templates. Use the project's internationalization / localization mechanism (i18n, translation dictionaries, or language toggles `isVi` / `language === 'vi'`) to provide both English (`en`) and Vietnamese (`vi`) options.
- **Data & Documentation**: Any generated reports, exports, or summaries meant for end-user presentations must provide both English and Vietnamese translations or allow switching dynamically.

## 2. Iconography & Visual Assets (No Emojis as Icons)
- **Strict Prohibition of Emojis as Icons**: NEVER use raw Unicode emojis (e.g., 📌, 🚀, ⚙️, ❌, ⚠️, 📄, 🔍) as UI icons, button graphics, action triggers, status indicators, or navigation symbols.
- **Dedicated Vector Icons Required**: All UI icons must be implemented using proper SVG components or established icon libraries (e.g., Lucide React, Heroicons, or dedicated custom SVGs).
- **Design System Cohesion**: Ensure icons follow consistent stroke width, size tokens, theme-aware colors (respecting dark/light themes), and accessible labeling (`aria-hidden="true"` or descriptive tooltips).
