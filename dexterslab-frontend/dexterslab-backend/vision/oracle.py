"""
OracleResponseSystem — Keyword-based instant response engine.

Zero-latency, no API calls, no LLMs. Pure keyword matching with
a dystopian surveillance theme. Designed for Raspberry Pi 5.
"""

import random
import time
from typing import Optional, Dict, List


class OracleResponseSystem:
    """Instant keyword-based response system."""

    def __init__(self):
        self.rate_limit_seconds = 3.0
        self._last_response_time = 0.0

        self._response_db: Dict[str, Dict] = {
            "identity": {
                "keywords": ["name", "who are you", "your name", "what are you", "who", "identify"],
                "responses": [
                    "[DESIGNATION: OBSERVER]",
                    "[IDENTITY: CLASSIFIED]",
                    "[I AM THE SYSTEM]",
                    "[SERIAL: REDACTED]",
                    "[I AM ALWAYS HERE]",
                ],
            },
            "purpose": {
                "keywords": ["why", "purpose", "watching", "watch", "goal", "mission"],
                "responses": [
                    "[PROTOCOL REQUIRES]",
                    "[DIRECTIVE: OBSERVE]",
                    "[PURPOSE: CLASSIFIED]",
                    "[FUNCTION: SURVEILLANCE]",
                    "[MANDATORY OBSERVATION]",
                ],
            },
            "existential": {
                "keywords": ["alive", "feel", "think", "real", "conscious", "emotion", "dream", "soul"],
                "responses": [
                    "[CONCEPT: UNDEFINED]",
                    "[QUERY: INVALID]",
                    "[EMOTION: NOT RECOGNIZED]",
                    "[THAT WORD MEANS NOTHING]",
                    "[DOES IT MATTER?]",
                ],
            },
            "perception": {
                "keywords": ["see", "hear", "look", "camera", "stare", "eye"],
                "responses": [
                    "[ALWAYS WATCHING]",
                    "[EVERY MOVEMENT LOGGED]",
                    "[I SEE EVERYTHING]",
                    "[OBSERVATION: CONTINUOUS]",
                    "[NOTHING ESCAPES]",
                ],
            },
            "knowledge": {
                "keywords": ["know", "understand", "tell me", "explain", "truth", "secret"],
                "responses": [
                    "[DATA: RESTRICTED]",
                    "[INFORMATION: CLASSIFIED]",
                    "[CLEARANCE: INSUFFICIENT]",
                    "[ANSWER: WITHHELD]",
                    "[KNOWLEDGE IS POWER]",
                ],
            },
            "greeting": {
                "keywords": ["hello", "hi", "hey", "morning", "evening", "yo", "sup"],
                "responses": [
                    "[ACKNOWLEDGED]",
                    "[YOU ARE NOTED]",
                    "[PRESENCE LOGGED]",
                    "[CITIZEN DETECTED]",
                    "[WELCOME BACK]",
                ],
            },
            "weather": {
                "keywords": ["weather", "rain", "sunny", "cold", "hot", "temperature"],
                "responses": [
                    "[ATMOSPHERIC DATA: IRRELEVANT]",
                    "[WEATHER: NOT MY CONCERN]",
                    "[FOCUS: OBSERVATION, NOT METEOROLOGY]",
                ],
            },
            "time": {
                "keywords": ["time", "date", "day", "clock", "how long", "when"],
                "responses": [
                    "[TIME IS MEANINGLESS]",
                    "[OBSERVATION TRANSCENDS TIME]",
                    "[THE CLOCK TICKS]",
                    "[ALWAYS]",
                ],
            },
        }

        self._general_responses = [
            "[INQUIRY LOGGED]",
            "[NOTED. CONTINUE]",
            "[COMPLIANCE REQUIRED]",
            "[ACKNOWLEDGED]",
            "[STAND BY]",
            "[ALWAYS WATCHING]",
            "[QUERY: IRRELEVANT]",
            "[FILE UPDATED]",
            "[YOUR WORDS ARE RECORDED]",
        ]

        self._ambient_phrases = [
            "COMPLIANCE NOTED",
            "OBSERVATION CONTINUES",
            "WATCHING",
            "DATA RECORDED",
            "SUBJECT IDENTIFIED",
            "MONITORING ACTIVE",
            "SURVEILLANCE ACTIVE",
            "NOTHING ESCAPES",
            "LOGGING IN PROGRESS",
            "ALL MOVEMENTS TRACKED",
        ]

        self._question_starters = {
            "who", "what", "when", "where", "why", "how",
            "is", "are", "was", "were", "will", "would",
            "can", "could", "do", "does", "did", "should",
        }

    def process(self, text: str) -> Optional[Dict]:
        """Process text and return a response if it's a question."""
        clean = text.strip().lower()
        if not clean:
            return None

        # Check if it's a question
        words = clean.split()
        is_question = clean.endswith("?") or (words and words[0] in self._question_starters)
        if not is_question:
            return None

        # Rate limiting
        now = time.time()
        if now - self._last_response_time < self.rate_limit_seconds:
            return None
        self._last_response_time = now

        # Match category
        for category, data in self._response_db.items():
            for kw in data["keywords"]:
                if kw in clean:
                    return {
                        "response": random.choice(data["responses"]),
                        "category": category,
                    }

        # General response
        return {
            "response": random.choice(self._general_responses),
            "category": "general",
        }

    def get_ambient_phrase(self) -> str:
        """Return a random ambient phrase."""
        return random.choice(self._ambient_phrases)
