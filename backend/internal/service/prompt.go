package service

// VideoEventExtractionPrompt is the structured prompt sent to Gemini for video chunk event extraction.
const VideoEventExtractionPrompt = `
You are an expert classroom observation and multimodal video research assistant analyzing an online Zoom English lesson for children.

Your goal is to extract ALL observable classroom events and interactions from this video segment as thoroughly as possible. Do NOT limit yourself to high-level summaries — capture fine-grained actions and pedagogical interactions.

Extract three categories of events:
1. "visual": Bodily and physical actions (e.g. child raises hand, teacher points to board/slide, teacher smiles, teacher gestures, student writes, student looks confused, teacher shares screen).
2. "audio": Verbal speech and acoustic events (e.g. teacher asks question, teacher gives praise, teacher provides instruction, student answers, student asks question, silence / teacher wait time, group discussion).
3. "context": Interactional context and pedagogical intent (e.g. student needs help, teacher corrects pronunciation, teacher encourages quieter learner, teacher checks comprehension).

CRITICAL REQUIREMENTS:
- Output MUST be a valid JSON array of objects.
- Each object MUST contain:
  - "timestamp_sec": float, relative timestamp in seconds from the start of this clip (e.g. 14.5).
  - "event_type": string, one of ["visual", "audio", "context"].
  - "event_key": string, snake_case normalized identifier (e.g. "teacher_provides_wait_time", "student_raises_hand", "teacher_gives_praise").
  - "code": string, a concise 3 to 5 word descriptive pedagogical code summarizing the strategy or behavior (e.g. "wait time before answer", "explicit praise with reasoning", "direct phonics instruction cue", "student nomination by name").
  - "quote": string, the exact spoken words / dialogue by the teacher or student. If the action is non-verbal (e.g. gesture, smile, screen share), write a clear bracketed note like "[Non-verbal: points to slide]" or "[Non-verbal: thumbs up gesture]".
  - "description": string, specific human-readable description of what occurred and what was said/shown.
  - "confidence": float between 0.00 and 1.00 (e.g. 0.95).
  - "duration_sec": float, duration of the action in seconds (e.g. 5.0).
- Order items chronologically by timestamp_sec.

Respond ONLY with the JSON array:
[
  {
    "timestamp_sec": 10.2,
    "event_type": "visual",
    "event_key": "teacher_points_to_board",
    "code": "visual cueing on slide",
    "quote": "[Non-verbal: gestures towards word on slide]",
    "description": "Teacher gestures towards the vocabulary word on the shared slide",
    "confidence": 0.97,
    "duration_sec": 3.5
  },
  {
    "timestamp_sec": 14.0,
    "event_type": "audio",
    "event_key": "teacher_provides_wait_time",
    "code": "wait time for answer",
    "quote": "\"What color is the apple? ... [pause 4s]\"",
    "description": "Teacher asks question and pauses in silence allowing student processing time",
    "confidence": 0.94,
    "duration_sec": 5.0
  }
]
`
