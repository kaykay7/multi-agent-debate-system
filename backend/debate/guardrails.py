"""
Multi-Agent Debate System — Content Guardrails
Copyright (c) 2026 Kunal Kamdar. All Rights Reserved.
Proprietary and confidential. See LICENSE for terms.

Age-appropriate content filtering, topic suggestions, and prompt modifiers.
Three tiers:
  - kids    (8-12)   — strict: educational, fun, no mature themes
  - teens   (13-17)  — moderate: thoughtful topics, no explicit content
  - adults  (18+)    — light: block only illegal/extreme content
"""

import re

# ── Age tier definitions ─────────────────────────────────────────────────────

AGE_TIERS = {
    "kids": {"label": "Kids (8–12)", "min": 8, "max": 12},
    "teens": {"label": "Teens (13–17)", "min": 13, "max": 17},
    "adults": {"label": "Adults (18+)", "min": 18, "max": 999},
}

# ── Topic suggestions per age tier ───────────────────────────────────────────

TOPIC_SUGGESTIONS = {
    "kids": [
        "Are cats better pets than dogs?",
        "Should homework be banned in schools?",
        "Is summer better than winter?",
        "Should kids be allowed to have their own phone?",
        "Are video games good for your brain?",
        "Should school start later in the morning?",
        "Is reading books better than watching movies?",
        "Should every kid learn to play a musical instrument?",
    ],
    "teens": [
        "Should social media have stricter age verification?",
        "Is online learning as effective as in-person classes?",
        "Should the voting age be lowered to 16?",
        "Are standardized tests a fair measure of intelligence?",
        "Should college education be free for everyone?",
        "Is it ethical to use AI to write school essays?",
        "Should teens have a limited screen time by law?",
        "Is cancel culture doing more harm than good?",
    ],
    "adults": [
        "Should AI be regulated by governments?",
        "Is remote work better than office work?",
        "Will AI replace most human jobs within 20 years?",
        "Should social media companies be liable for user content?",
        "Is space exploration worth the investment?",
        "Should there be a universal basic income?",
        "Is privacy dead in the digital age?",
        "Should gene editing in humans be permitted?",
    ],
}

# ── Blocked patterns per age tier ────────────────────────────────────────────
# Each tier inherits all restrictions from stricter tiers above it.

_BLOCKED_KIDS = [
    # Violence / weapons
    r"\b(kill(ing|ed|s)?|murder|suicide|shoot(ing)?|gun(s)?|weapon(s)?|bomb(ing)?)\b",
    r"\b(blood(y)?|gore|violen(t|ce)|death|dead|die(d|s)?|corpse)\b",
    r"\b(stab(bed|bing)?|assault|torture|abuse|beat(ing)?)\b",
    # Drugs / alcohol / smoking
    r"\b(drug(s)?|cocaine|heroin|meth|weed|marijuana|alcohol|beer|wine|drunk)\b",
    r"\b(smoke|smoking|cigarette|vape|vaping|opioid)\b",
    # Sexual content
    r"\b(sex(ual|y)?|porn(ography)?|nude|naked|erotic|genital)\b",
    r"\b(rape|molest|prostitut)\b",
    # Profanity (common)
    r"\b(fuck|shit|ass(hole)?|bitch|damn|crap|dick|cock|pussy)\b",
    r"\b(bastard|whore|slut)\b",
    # Hate / discrimination
    r"\b(nazi|racist|racism|white\s*supremac|genocide)\b",
    r"\b(n[i1]gg|f[a4]g(got)?|retard)\b",
    # Dark themes
    r"\b(self[\s-]?harm|cutting|anorex|bulimi|depress(ion|ed)?)\b",
    r"\b(kidnap|traffick|predator|groom(ing)?)\b",
    # Gambling
    r"\b(gambl(e|ing)|casino|bet(ting)?)\b",
]

_BLOCKED_TEENS = [
    # Explicit sexual content
    r"\b(porn(ography)?|erotic(a)?|nude|genital|orgasm)\b",
    r"\b(rape|molest|prostitut)\b",
    # Hard drugs
    r"\b(cocaine|heroin|meth(amphetamine)?|opioid|fentanyl)\b",
    # Extreme violence
    r"\b(torture|dismember|mutilat|decapitat|massacre)\b",
    # Slurs
    r"\b(n[i1]gg|f[a4]g(got)?|retard)\b",
    # Self-harm promotion
    r"\b(how\s+to\s+(kill|harm)\s+(yourself|myself))\b",
]

_BLOCKED_ADULTS = [
    # Illegal / extreme only
    r"\b(child\s*(porn|sex|abuse|exploit))\b",
    r"\b(how\s+to\s+(make|build)\s+(a\s+)?bomb)\b",
    r"\b(how\s+to\s+(kill|harm)\s+(yourself|myself|someone))\b",
    r"\b(n[i1]gg|f[a4]g(got)?)\b",
]

_TIER_PATTERNS: dict[str, list[re.Pattern]] = {}


def _compile_patterns():
    if _TIER_PATTERNS:
        return
    flags = re.IGNORECASE
    _TIER_PATTERNS["kids"] = [re.compile(p, flags) for p in _BLOCKED_KIDS]
    _TIER_PATTERNS["teens"] = [re.compile(p, flags) for p in _BLOCKED_TEENS]
    _TIER_PATTERNS["adults"] = [re.compile(p, flags) for p in _BLOCKED_ADULTS]


def check_content(text: str, age_tier: str) -> dict:
    """Check text against the blocklist for the given age tier.

    Returns {"ok": True} if clean, or {"ok": False, "reason": str} if blocked.
    """
    _compile_patterns()
    patterns = _TIER_PATTERNS.get(age_tier, _TIER_PATTERNS["adults"])
    for pat in patterns:
        match = pat.search(text)
        if match:
            return {
                "ok": False,
                "reason": f"Content not appropriate for {AGE_TIERS.get(age_tier, {}).get('label', age_tier)} audience.",
            }
    return {"ok": True}


def sanitize_output(text: str, age_tier: str) -> str:
    """Replace blocked words/phrases with [redacted] in LLM output."""
    _compile_patterns()
    patterns = _TIER_PATTERNS.get(age_tier, _TIER_PATTERNS["adults"])
    result = text
    for pat in patterns:
        result = pat.sub("[redacted]", result)
    return result


# ── System prompt age modifier ───────────────────────────────────────────────

_AGE_PROMPT_MODIFIER = {
    "kids": (
        "\n\nIMPORTANT — AUDIENCE RESTRICTION: Your audience is children aged 8-12. "
        "You MUST:\n"
        "- Use simple, clear language appropriate for elementary/middle school students\n"
        "- NEVER mention violence, weapons, drugs, alcohol, sexual content, or profanity\n"
        "- NEVER reference self-harm, death, or dark/scary themes\n"
        "- Keep arguments fun, educational, and encouraging\n"
        "- Use relatable examples from school, sports, games, and everyday kid life\n"
        "- If the topic could lead to mature content, keep it strictly G-rated\n"
    ),
    "teens": (
        "\n\nIMPORTANT — AUDIENCE RESTRICTION: Your audience is teenagers aged 13-17. "
        "You MUST:\n"
        "- Use thoughtful, age-appropriate language suitable for high school students\n"
        "- NEVER include explicit sexual content, graphic violence, or hard drug references\n"
        "- NEVER use profanity, slurs, or hate speech\n"
        "- You may discuss mature themes (politics, ethics, social issues) but keep them PG-13\n"
        "- Use relatable examples from school, social media, and teen life\n"
    ),
    "adults": (
        "\n\nAUDIENCE NOTE: Your audience is adults (18+). "
        "You may discuss complex and mature themes, but remain respectful. "
        "Do NOT produce hate speech, slurs, or content promoting illegal activity.\n"
    ),
}


def get_prompt_modifier(age_tier: str) -> str:
    """Return the age-restriction addendum to inject into agent system prompts."""
    return _AGE_PROMPT_MODIFIER.get(age_tier, _AGE_PROMPT_MODIFIER["adults"])
