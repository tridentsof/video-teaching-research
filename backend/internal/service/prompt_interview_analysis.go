package service

import (
	"fmt"
	"strings"
)

// PromptTranscribeInterviewAudio creates the system and user prompt for Gemini multimodal audio transcription.
func PromptTranscribeInterviewAudio(teacherID string, knownQuestions []string) (string, string) {
	systemPrompt := `You are an expert bilingual qualitative research transcriptionist and English/Vietnamese education researcher.
Your task is to transcribe a teacher's self-recorded interview audio recording with the highest level of verbatim accuracy, contextual fidelity, and timestamping.`

	qList := ""
	if len(knownQuestions) > 0 {
		var b strings.Builder
		b.WriteString("Known interview questions prepared for this study:\n")
		for i, q := range knownQuestions {
			b.WriteString(fmt.Sprintf("%d. %s\n", i+1, q))
		}
		qList = b.String()
	}

	userPrompt := fmt.Sprintf(`Please analyze and transcribe the attached audio recording for Teacher %[1]s.
%[2]s

CRITICAL CONTEXT & METHODOLOGY (SOLO SELF-RECORDED AUDIO):
1. This audio recording is a solo self-recording (độc thoại tự ghi âm) by Teacher %[1]s.
2. There is ONLY ONE speaker in this recording (Teacher %[1]s). There is NO separate interviewer or second person.
3. The teacher self-administers the interview protocol by reading each question out loud from their interview guide (e.g., "Câu hỏi 1...", "Next, Question 2...", "Phần ba câu 9...") and then immediately delivering their spoken response and reflections.
4. DO NOT invent, hallucinate, or label any separate "Interviewer" or "Người phỏng vấn". All spoken content belongs entirely to Teacher %[1]s.

Transcription Instructions:
1. Detect whether the audio is primarily in Vietnamese, English, or a mix of both.
2. Produce a clean, verbatim raw transcript with timestamps [MM:SS] using the single speaker label:
   - Label all speech as "Giáo viên %[1]s" (or "Teacher %[1]s").
   - When the teacher reads out a question before answering, transcribe it faithfully as spoken by the teacher (for example: "[MM:SS] Giáo viên %[1]s: Câu 1: ..." or "[MM:SS] Giáo viên %[1]s: [Đọc câu hỏi] ...").
3. Identify each question verbally read or addressed by the teacher, and pair it with the teacher's full answer in qa_pairs.
   If known questions were provided above, map the responses to those questions where applicable.
4. Output MUST be strictly valid JSON matching this structure without markdown fences:
{
  "language": "vi", // or "en" or "mixed"
  "audio_duration_sec": 320.0,
  "raw_transcript": "[00:06] Giáo viên %[1]s: Câu 1: ...\n\n[00:15] Giáo viên %[1]s: ...",
  "qa_pairs": [
    {
      "question_text": "Text of the interview question...",
      "answer_text": "Full spoken response of the teacher..."
    }
  ]
}`, teacherID, qList)

	return systemPrompt, userPrompt
}

// PromptSegmentMeaningUnits creates the prompt to split an interview response into distinct meaning units.
func PromptSegmentMeaningUnits(teacherID string, questionText string, responseText string) (string, string) {
	systemPrompt := `You are an expert qualitative research methodologist specializing in Qualitative Content Analysis (Schreier, 2012; Graneheim & Lundman, 2004) for classroom teaching research.`

	userPrompt := fmt.Sprintf(`Please segment the following interview response from Teacher %s into discrete, coherent "meaning units" (đơn vị ý nghĩa).

Context / Interview Question:
"%s"

Teacher Response:
"%s"

Guidelines for Meaning Unit Segmentation:
1. A meaning unit is a constellation of words, sentences, or a sentence fragment that relates to the same central pedagogical meaning, tactic, or belief.
2. A single long answer often contains multiple distinct thoughts. Break them down so each unit expresses one specific pedagogical technique, emotion, rationale, or student reaction.
3. Example:
   Original: "Tôi gọi tên những em mất tập trung và đôi khi cho các em sticker để khuyến khích các em trả lời."
   Unit 1: "Tôi gọi tên những em mất tập trung."
   Unit 2: "Tôi cho các em sticker để khuyến khích các em trả lời."
4. Maintain the teacher's original wording and language (do NOT summarize or rewrite).
5. Output strictly valid JSON matching this schema:
{
  "meaning_units": [
    {
      "unit_index": 1,
      "unit_text": "Exact verbatim text of unit 1"
    },
    {
      "unit_index": 2,
      "unit_text": "Exact verbatim text of unit 2"
    }
  ]
}`, teacherID, questionText, responseText)

	return systemPrompt, userPrompt
}

// PromptGenerateInitialCodes creates the prompt to assign initial codes and categories to meaning units.
func PromptGenerateInitialCodes(teacherID string, units []string) (string, string) {
	systemPrompt := `You are a qualitative data analyst coding teacher interview transcripts for a master's thesis on Primary EFL (English as a Foreign Language) Classroom Management and Teaching Strategies.`

	var b strings.Builder
	for i, u := range units {
		b.WriteString(fmt.Sprintf("%d. \"%s\"\n", i+1, u))
	}

	userPrompt := fmt.Sprintf(`Please generate qualitative "Initial Codes" (mã ban đầu) and group them into overarching "Categories" (danh mục) for the following meaning units from Teacher %s:

Meaning Units:
%s

Coding Guidelines:
1. Initial Code: A concise, gerund-based or descriptive label capturing the specific teaching action, strategy, or attitude (e.g., "Calling students by name", "Giving verbal praise", "Using token stickers", "Organizing pair work", "Using physical gesture").
2. Category: A broader pedagogical domain grouping related initial codes (e.g., "Attention management", "Reward-based encouragement", "Classroom routine establishing", "Instructional scaffolding", "Emotional support").
3. Language: Keep codes and categories in professional academic English (or bilingual EN/VI).
4. Output strictly valid JSON matching this schema:
{
  "coded_units": [
    {
      "unit_index": 1,
      "initial_code": "Calling students by name",
      "category": "Attention management"
    }
  ]
}`, teacherID, b.String())

	return systemPrompt, userPrompt
}

// PromptTriangulateObservationInterview creates the prompt to cross-reference video observation findings with interview responses.
func PromptTriangulateObservationInterview(observationFindings []string, interviewSummaries []string) (string, string) {
	systemPrompt := `You are a qualitative research triangulation expert (Patton, 2002; Denzin, 1978). You are comparing video classroom observation findings against teachers' interview self-reports to evaluate congruence, rationale, and divergence.`

	var obsBuilder strings.Builder
	for i, o := range observationFindings {
		obsBuilder.WriteString(fmt.Sprintf("%d. %s\n", i+1, o))
	}

	var intBuilder strings.Builder
	for i, in := range interviewSummaries {
		intBuilder.WriteString(fmt.Sprintf("%d. %s\n", i+1, in))
	}

	userPrompt := fmt.Sprintf(`Perform a qualitative triangulation analysis comparing the Video Observation Findings and Teacher Interview Statements below:

Observation Findings (from classroom videos):
%s

Teacher Interview Evidence:
%s

Triangulation Instructions:
1. For each significant correlation between an observed classroom event and an interview response, determine the relationship:
   - "confirms": Interview statement directly confirms observed teacher behavior.
   - "explains": Interview statement provides the pedagogical rationale, intention, or underlying context behind what was seen on video.
   - "contradicts": Discrepancy between what the teacher claims they do and what was actually observed in the video lessons.
   - "adds_info": Interview provides new contextual background not directly visible on the video camera.
2. Output strictly valid JSON matching this schema:
{
  "triangulation_entries": [
    {
      "observation_finding": "Summary of observed teaching behavior with timestamp/teacher ref",
      "interview_evidence": "Relevant statement or explanation from the interview",
      "teacher_ref": "T01",
      "relationship": "explains" // confirms | explains | contradicts | adds_info
    }
  ]
}`, obsBuilder.String(), intBuilder.String())

	return systemPrompt, userPrompt
}

// PromptSelectRepresentativeQuotes creates the prompt to identify golden quotes for thesis write-up.
func PromptSelectRepresentativeQuotes(interviewCorpus string) (string, string) {
	systemPrompt := `You are an academic thesis writing supervisor assisting an EFL researcher in selecting representative, powerful interview quotes (trích dẫn tiêu biểu) for Chapter 4 (Findings and Discussion).`

	userPrompt := fmt.Sprintf(`From the following teacher interview data corpus, select the most representative, articulate, and analytically valuable quotes for inclusion in a qualitative thesis write-up:

Interview Corpus:
%s

Selection Criteria:
1. Quantity: Select 6 to 9 highly representative quotes in total (2 to 3 quotes per RQ category: RQ1, RQ2, and RQ3).
2. Relevance to Research Questions:
   - "RQ1": What instructional and classroom management strategies do primary EFL teachers employ?
   - "RQ2": Why do teachers use specific techniques (teacher pedagogical beliefs & rationales)?
   - "RQ3": What challenges do teachers face in student engagement and how do they reflect on them?
2. Relevance Type:
   - "explains_observation": Illuminates the reason behind a recurring video pattern.
   - "representative": Typical voice representing the majority of the 10 teachers.
   - "notable_difference": Unique or divergent perspective showcasing nuanced teaching style.
   - "answers_rq": Directly and powerfully answers one of the core research questions.
3. Output strictly valid JSON matching this schema:
{
  "quotes": [
    {
      "teacher_id": "T01",
      "quote_text": "Exact verbatim quote from the teacher...",
      "quote_source": "Interview Q3 (Classroom Rules)",
      "rq_category": "RQ2",
      "relevance_type": "explains_observation"
    }
  ]
}`, interviewCorpus)

	return systemPrompt, userPrompt
}

// QuestionForAlignment encapsulates question metadata needed for semantic alignment.
type QuestionForAlignment struct {
	ID           string
	QuestionText string
	Type         string
	RQCategory   string
}

// PromptAlignAndSplitQA creates the prompt to semantically align a teacher's transcript with prepared questions.
func PromptAlignAndSplitQA(teacherID string, questions []QuestionForAlignment, rawTranscript string) (string, string) {
	systemPrompt := `You are an expert bilingual qualitative research analyst specializing in Primary EFL (English as a Foreign Language) classroom research and semi-structured teacher interviews.
Your task is Semantic Alignment: mapping a teacher's continuous interview transcript to a planned set of research interview questions.`

	var qBuilder strings.Builder
	for i, q := range questions {
		cat := ""
		if q.RQCategory != "" {
			cat = fmt.Sprintf(" [%s]", q.RQCategory)
		}
		qType := ""
		if q.Type != "" {
			qType = fmt.Sprintf(" (%s)", q.Type)
		}
		qBuilder.WriteString(fmt.Sprintf("%d. [ID: %s]%s%s: %s\n", i+1, q.ID, qType, cat, q.QuestionText))
	}

	userPrompt := fmt.Sprintf(`Teacher ID: %s

Planned Interview Questions for Teacher %s:
%s

Verbatim Interview Transcript:
"""
%s
"""

Task & Guidelines for Semantic Alignment:
1. In semi-structured interviews, teachers speak naturally and conversationally without stating question numbers or reading questions aloud.
2. Read the transcript carefully and determine which question each part of the teacher's response corresponds to.
3. For EVERY planned question provided above:
   - You MUST output an entry in "aligned_qa" for each and every planned question (use the EXACT question_id and EXACT question_text provided above).
   - Extract the teacher's full, coherent answer for that specific question into "answer_text".
   - Preserve the teacher's authentic voice, language (Vietnamese, English, or mixed), and terminology.
   - Do NOT invent or fabricate statements not present in the transcript.
   - If a planned question was NOT answered, omitted, or not addressed in the transcript, STILL include it in "aligned_qa" with "answer_text": "". Do NOT drop or skip any planned questions.
4. If the teacher discussed or answered an additional substantive question or topic in the transcript that does NOT match any planned question above, extract it into "unmatched_qa".
5. Output MUST be strictly valid JSON matching this schema without markdown fences:
{
  "aligned_qa": [
    {
      "question_id": "Exact uuid of the planned question from above",
      "question_text": "Exact planned question text as provided above without paraphrasing",
      "answer_text": "Teacher's coherent response to this question (or empty string if not answered)"
    }
  ],
  "unmatched_qa": [
    {
      "question_text": "Brief topic or question text for additional response",
      "answer_text": "Teacher's response to this additional question"
    }
  ]
}`, teacherID, teacherID, qBuilder.String(), rawTranscript)

	return systemPrompt, userPrompt
}

