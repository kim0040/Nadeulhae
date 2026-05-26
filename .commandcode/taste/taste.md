# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# workflow
- After completing changes, always commit and push to git. Confidence: 0.90
- Always run build tests (`npm run build` or `next build`) after making code changes and fix any warnings/errors. Confidence: 0.85
- Do not modify code automatically; report issues to user first and wait for approval before making changes. Confidence: 0.85

# ui
- Use Magic UI components and design patterns throughout the site. Confidence: 0.85
- Support both light and dark themes in all components. Confidence: 0.80
- Optimize all UI for mobile devices. Confidence: 0.80

# i18n
- Support Korean (한국어) and English in all user-facing text and UI. Confidence: 0.85

# security
- Never commit API keys, passwords, or sensitive credentials to git. Store them in .env.local. Confidence: 0.90

# time
- Use server time (not client time) as the canonical time source for all features. Confidence: 0.75

