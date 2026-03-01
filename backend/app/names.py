import random

from app.config import settings

ADJECTIVES = [
    "amber", "bold", "bright", "calm", "cool", "crisp", "dark", "deep",
    "dry", "dusk", "fair", "fast", "firm", "free", "fresh", "full",
    "glad", "gold", "grand", "green", "grey", "keen", "kind", "late",
    "lean", "light", "live", "long", "loud", "mild", "neat", "pale",
    "pure", "quick", "rare", "raw", "red", "rich", "ripe", "safe",
    "sharp", "shy", "slim", "slow", "soft", "still", "swift", "tall",
    "thin", "warm",
]

NOUNS = [
    "arch", "bark", "bell", "bird", "bloom", "bolt", "brook", "cave",
    "clay", "cliff", "cloud", "coal", "cove", "crane", "creek", "crow",
    "dawn", "dew", "drift", "dune", "elm", "ember", "fern", "finch",
    "flame", "flint", "frost", "gale", "glen", "grove", "haze", "hawk",
    "hill", "ivy", "jade", "lake", "lark", "leaf", "marsh", "mist",
    "moon", "moss", "oak", "petal", "pine", "pond", "reef", "ridge",
    "sage", "stone",
]


def generate_name() -> str:
    """Generate a unique word-word profile name like 'calm-brook'."""
    existing = set()
    if settings.profiles_dir.exists():
        existing = {d.name for d in settings.profiles_dir.iterdir() if d.is_dir()}

    for _ in range(100):
        name = f"{random.choice(ADJECTIVES)}-{random.choice(NOUNS)}"
        if name not in existing:
            return name

    # Fallback: append a number
    base = f"{random.choice(ADJECTIVES)}-{random.choice(NOUNS)}"
    i = 2
    while f"{base}-{i}" in existing:
        i += 1
    return f"{base}-{i}"
