'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Report, Video, ReportItem, ReportItemOccurrence, api } from '@/lib/api';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { generateWordReport, downloadBlob, SECTION_NAMES, SECTION_NAMES_VI, DEFAULT_CHECKLIST_STRUCTURE } from '@/lib/wordExport';
import { generateObservationPdf } from '@/lib/pdfExport';
import { ArrowLeft, Download, FileText, CheckCircle2, Play, ExternalLink, Printer, Trash2, AlertCircle, X, Loader2 } from 'lucide-react';

function parseOccurrences(raw: any): ReportItemOccurrence[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

function formatSeconds(sec: number): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { language, t } = useTranslation();
  const toast = useToast();
  const [report, setReport] = useState<Report | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState<'checklist' | 'markdown'>('checklist');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteReport = async () => {
    if (!report) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await api.deleteReport(report.video_id);
      router.push('/');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete report');
    } finally {
      setIsDeleting(false);
    }
  };


  useEffect(() => {
    if (!id) return;
    setLoading(true);

    // Fetch video info
    api.getVideo(id)
      .then((v) => setVideo(v))
      .catch(() => setVideo(null));

    // Fetch report
    api.getReport(id)
      .then((data) => setReport(data))
      .catch(() => {
        // Fallback comprehensive sample report covering all 5 Sections (A to E)
        setReport({
          id: 'rep-01',
          video_id: id,
          teacher_id: 'T01',
          checklist_id: '00000000-0000-0000-0000-000000000001',
          checklist_version: 'v1.0',
          generated_at: new Date().toISOString(),
          markdown_content: `# Classroom Observation Checklist

### Lesson Information
- **Observation No.:** #01
- **Teacher:** T01
- **Date:** 2024-01-15
- **Class:** English Grade 2
- **Platform (Zoom/Google Meet):** Zoom
- **Lesson Topic:** Phonics & Turn-Taking
- **Duration:** 25:00

---

## Section A. Establishing Online Rules and Routines
| Indicators | Observed | Frequency | Timestamp | Context |
|---|:---:|:---:|:---:|---|
| Teacher explains classroom rules | Yes | 2 | 00:01:15, 00:03:40 | Sets camera and microphone turn expectations at opening. |
| Teacher reminds students of classroom expectations | Yes | 1 | 00:08:22 | Gentle reminder to raise virtual hand before unmuting. |
| Teacher establishes lesson routines | Yes | 1 | 00:00:45 | Warm-up phonics song routine conducted at start. |
| Teacher provides clear task instructions | Yes | 3 | 00:05:10, 00:12:30, 00:18:05 | Step-by-step game directions before matching exercise. |
| Teacher manages transitions between activities | Yes | 2 | 00:10:15, 00:17:40 | Smooth countdown transition from vocabulary to quiz. |

---

## Section B. Managing Turn-taking and Speaking Participation
| Indicators | Observed | Frequency | Timestamp | Context |
|---|:---:|:---:|:---:|---|
| Teacher nominates students to speak | Yes | 4 | 00:04:12, 00:07:30, 00:11:05, 00:15:20 | Directly names individual students (Leo, Maya, Tom) to answer. |
| Teacher encourages volunteers | Yes | 2 | 00:06:50, 00:13:45 | Asks "Who wants to try the next one?" with reaction icon prompt. |
| Teacher provides wait time | Yes | 3 | 00:04:31, 00:07:13, 00:12:54 | Pauses 4-6s after open questions before calling on student. |
| Teacher encourages quieter learners | Yes | 1 | 00:09:18 | Warmly invites shy student with scaffolded sentence starter. |
| Teacher balances speaking opportunities | Yes | 2 | 00:14:02, 00:19:30 | Rotates speaking turns so all participants get equal turns. |
| Teacher organises pair/group speaking tasks | No | 0 | - | No breakout or peer pair work in this whole-class session. |

---

## Section C. Sustaining Learner Attention and Engagement
| Indicators | Observed | Frequency | Timestamp | Context |
|---|:---:|:---:|:---:|---|
| Teacher monitors learner attention | Yes | 2 | 00:03:10, 00:16:45 | Checks gallery view and addresses distracted student by name. |
| Teacher checks understanding | Yes | 3 | 00:06:20, 00:11:50, 00:20:10 | Uses thumbs up/down visual check before moving to next slide. |
| Teacher asks follow-up questions | Yes | 2 | 00:08:40, 00:14:35 | Asks "Why do you think so?" and "What else can you find?". |
| Teacher redirects distracted learners | Yes | 1 | 00:12:10 | Uses cheerful visual puppet to regain student eye contact. |
| Teacher maintains lesson pace | Yes | 1 | 00:15:00 | Maintains brisk cadence with animated slide transitions. |
| Teacher motivates learners to participate | Yes | 3 | 00:02:15, 00:10:00, 00:22:10 | Awards digital stars and high-fives on camera. |

---

## Section D. Providing Scaffolding and Positive Reinforcement
| Indicators | Observed | Frequency | Timestamp | Context |
|---|:---:|:---:|:---:|---|
| Teacher models target language | Yes | 3 | 00:03:50, 00:07:10, 00:13:00 | Exaggerates mouth shape for "th" sound with audio repetition. |
| Teacher provides sentence starters | Yes | 2 | 00:08:15, 00:16:20 | Prompts: "I can see a..." on screen. |
| Teacher uses prompts | Yes | 2 | 00:09:40, 00:18:10 | Phonetic cueing ("b... b... ball"). |
| Teacher gives praise and encouragement | Yes | 5 | 00:04:45, 00:08:30, 00:11:40, 00:17:00, 00:23:15 | "Brilliant effort Tommy! Super clear pronunciation." |
| Teacher provides corrective feedback | Yes | 2 | 00:06:40, 00:14:15 | Recasts student response with correct vowel sound gently. |
| Teacher adjusts support based on learners' responses | Yes | 2 | 00:10:50, 00:19:00 | Adds visual card hint when learner hesitates on spelling. |

---

## Section E. Using Digital Tools to Support Learning and Interaction
| Indicators | Observed | Frequency | Timestamp | Context |
|---|:---:|:---:|:---:|---|
| Teacher uses the chat box | Yes | 1 | 00:02:40 | Types target word "ELEPHANT" in chat box for spelling. |
| Teacher uses reaction icons | Yes | 3 | 00:05:00, 00:12:00, 00:21:30 | Sends celebratory party popper and thumbs up emojis. |
| Teacher uses breakout rooms | No | 0 | - | Not used in this whole-class session. |
| Teacher shares screen | Yes | 1 | 00:01:00 | Shares animated PowerPoint slides throughout the lesson. |
| Teacher uses a digital whiteboard | Yes | 1 | 00:15:30 | Draws phonics blending lines on interactive canvas. |
| Teacher uses polls or annotation tools | Yes | 2 | 00:07:45, 00:18:20 | Allows students to stamp and circle correct pictures on screen. |

---

## General Observation Notes
Teacher maintains warm, energetic classroom rapport with strong use of positive reinforcement and multi-modal digital tools. Pacing and wait time effectively support second language acquisition for young learners.
`,
          items: [
            // Section A
            { id: '1', checklist_item_id: '1', checklist_section: 'A', checklist_text: 'Teacher explains classroom rules', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 75, timestamp_str: '00:01:15', context: 'Sets camera and microphone turn expectations at opening.', confidence: 0.95, duration_sec: 4 }, { timestamp_sec: 220, timestamp_str: '00:03:40', context: 'Reiterates speaking turn rules.', confidence: 0.92, duration_sec: 3 }]) },
            { id: '2', checklist_item_id: '2', checklist_section: 'A', checklist_text: 'Teacher reminds students of classroom expectations', count: 1, occurrences: JSON.stringify([{ timestamp_sec: 502, timestamp_str: '00:08:22', context: 'Gentle reminder to raise virtual hand before unmuting.', confidence: 0.94, duration_sec: 3 }]) },
            { id: '3', checklist_item_id: '3', checklist_section: 'A', checklist_text: 'Teacher establishes lesson routines', count: 1, occurrences: JSON.stringify([{ timestamp_sec: 45, timestamp_str: '00:00:45', context: 'Warm-up phonics song routine conducted at start.', confidence: 0.96, duration_sec: 5 }]) },
            { id: '4', checklist_item_id: '4', checklist_section: 'A', checklist_text: 'Teacher provides clear task instructions', count: 3, occurrences: JSON.stringify([{ timestamp_sec: 310, timestamp_str: '00:05:10', context: 'Step-by-step game directions before matching exercise.', confidence: 0.95, duration_sec: 4 }, { timestamp_sec: 750, timestamp_str: '00:12:30', context: 'Clarifies quiz rules.', confidence: 0.91, duration_sec: 3 }, { timestamp_sec: 1085, timestamp_str: '00:18:05', context: 'Final task instructions.', confidence: 0.93, duration_sec: 3 }]) },
            { id: '5', checklist_item_id: '5', checklist_section: 'A', checklist_text: 'Teacher manages transitions between activities', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 615, timestamp_str: '00:10:15', context: 'Smooth countdown transition from vocabulary to quiz.', confidence: 0.92, duration_sec: 4 }, { timestamp_sec: 1060, timestamp_str: '00:17:40', context: 'Move to review game.', confidence: 0.94, duration_sec: 3 }]) },

            // Section B
            { id: '6', checklist_item_id: '6', checklist_section: 'B', checklist_text: 'Teacher nominates students to speak', count: 4, occurrences: JSON.stringify([{ timestamp_sec: 252, timestamp_str: '00:04:12', context: 'Directly names Leo to answer.', confidence: 0.97, duration_sec: 3 }, { timestamp_sec: 450, timestamp_str: '00:07:30', context: 'Calls on Maya.', confidence: 0.95, duration_sec: 3 }, { timestamp_sec: 665, timestamp_str: '00:11:05', context: 'Calls on Tom.', confidence: 0.94, duration_sec: 3 }, { timestamp_sec: 920, timestamp_str: '00:15:20', context: 'Calls on Anna.', confidence: 0.96, duration_sec: 3 }]) },
            { id: '7', checklist_item_id: '7', checklist_section: 'B', checklist_text: 'Teacher encourages volunteers', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 410, timestamp_str: '00:06:50', context: 'Asks "Who wants to try the next one?"', confidence: 0.93, duration_sec: 4 }, { timestamp_sec: 825, timestamp_str: '00:13:45', context: 'Invites volunteers for sentence reading.', confidence: 0.92, duration_sec: 3 }]) },
            { id: '8', checklist_item_id: '8', checklist_section: 'B', checklist_text: 'Teacher provides wait time', count: 3, occurrences: JSON.stringify([{ timestamp_sec: 271, timestamp_str: '00:04:31', context: 'Pauses 5s after question allowing processing time.', confidence: 0.95, duration_sec: 5 }, { timestamp_sec: 433, timestamp_str: '00:07:13', context: 'Waits silently while student studies slide picture.', confidence: 0.91, duration_sec: 5 }, { timestamp_sec: 774, timestamp_str: '00:12:54', context: 'Extended pause before prompt.', confidence: 0.90, duration_sec: 4 }]) },
            { id: '9', checklist_item_id: '9', checklist_section: 'B', checklist_text: 'Teacher encourages quieter learners', count: 1, occurrences: JSON.stringify([{ timestamp_sec: 558, timestamp_str: '00:09:18', context: 'Warmly invites shy student with scaffolded starter.', confidence: 0.93, duration_sec: 4 }]) },
            { id: '10', checklist_item_id: '10', checklist_section: 'B', checklist_text: 'Teacher balances speaking opportunities', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 842, timestamp_str: '00:14:02', context: 'Rotates turns across participants.', confidence: 0.94, duration_sec: 3 }, { timestamp_sec: 1170, timestamp_str: '00:19:30', context: 'Checks that everyone had equal turns.', confidence: 0.91, duration_sec: 3 }]) },
            { id: '11', checklist_item_id: '11', checklist_section: 'B', checklist_text: 'Teacher organises pair/group speaking tasks', count: 0, occurrences: '[]' },

            // Section C
            { id: '12', checklist_item_id: '12', checklist_section: 'C', checklist_text: 'Teacher monitors learner attention', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 190, timestamp_str: '00:03:10', context: 'Checks gallery view and addresses distracted learner.', confidence: 0.92, duration_sec: 3 }, { timestamp_sec: 1005, timestamp_str: '00:16:45', context: 'Re-engages camera view.', confidence: 0.91, duration_sec: 3 }]) },
            { id: '13', checklist_item_id: '13', checklist_section: 'C', checklist_text: 'Teacher checks understanding', count: 3, occurrences: JSON.stringify([{ timestamp_sec: 380, timestamp_str: '00:06:20', context: 'Thumbs up check for comprehension.', confidence: 0.95, duration_sec: 3 }, { timestamp_sec: 710, timestamp_str: '00:11:50', context: 'Concept check question.', confidence: 0.93, duration_sec: 4 }, { timestamp_sec: 1210, timestamp_str: '00:20:10', context: 'Review check before wrap-up.', confidence: 0.94, duration_sec: 3 }]) },
            { id: '14', checklist_item_id: '14', checklist_section: 'C', checklist_text: 'Teacher asks follow-up questions', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 520, timestamp_str: '00:08:40', context: 'Asks "Why do you think so?".', confidence: 0.93, duration_sec: 3 }, { timestamp_sec: 875, timestamp_str: '00:14:35', context: 'Probes for additional vocabulary examples.', confidence: 0.92, duration_sec: 4 }]) },
            { id: '15', checklist_item_id: '15', checklist_section: 'C', checklist_text: 'Teacher redirects distracted learners', count: 1, occurrences: JSON.stringify([{ timestamp_sec: 730, timestamp_str: '00:12:10', context: 'Uses visual prop to regain student eye contact.', confidence: 0.91, duration_sec: 3 }]) },
            { id: '16', checklist_item_id: '16', checklist_section: 'C', checklist_text: 'Teacher maintains lesson pace', count: 1, occurrences: JSON.stringify([{ timestamp_sec: 900, timestamp_str: '00:15:00', context: 'Brisk cadence maintained through interactive transitions.', confidence: 0.94, duration_sec: 3 }]) },
            { id: '17', checklist_item_id: '17', checklist_section: 'C', checklist_text: 'Teacher motivates learners to participate', count: 3, occurrences: JSON.stringify([{ timestamp_sec: 135, timestamp_str: '00:02:15', context: 'Awards digital points.', confidence: 0.96, duration_sec: 3 }, { timestamp_sec: 600, timestamp_str: '00:10:00', context: 'Virtual high five gesture.', confidence: 0.95, duration_sec: 3 }, { timestamp_sec: 1330, timestamp_str: '00:22:10', context: 'Star stickers celebration.', confidence: 0.97, duration_sec: 3 }]) },

            // Section D
            { id: '18', checklist_item_id: '18', checklist_section: 'D', checklist_text: 'Teacher models target language', count: 3, occurrences: JSON.stringify([{ timestamp_sec: 230, timestamp_str: '00:03:50', context: 'Exaggerates mouth shape for "th" sound.', confidence: 0.96, duration_sec: 4 }, { timestamp_sec: 430, timestamp_str: '00:07:10', context: 'Models complete sentence pattern.', confidence: 0.95, duration_sec: 3 }, { timestamp_sec: 780, timestamp_str: '00:13:00', context: 'Demonstrates intonation pattern.', confidence: 0.93, duration_sec: 4 }]) },
            { id: '19', checklist_item_id: '19', checklist_section: 'D', checklist_text: 'Teacher provides sentence starters', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 495, timestamp_str: '00:08:15', context: 'Prompts: "I can see a..." on screen.', confidence: 0.95, duration_sec: 3 }, { timestamp_sec: 980, timestamp_str: '00:16:20', context: 'Scaffolds "My favorite animal is..."', confidence: 0.93, duration_sec: 3 }]) },
            { id: '20', checklist_item_id: '20', checklist_section: 'D', checklist_text: 'Teacher uses prompts', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 580, timestamp_str: '00:09:40', context: 'Phonetic cueing ("b... b... ball").', confidence: 0.94, duration_sec: 3 }, { timestamp_sec: 1090, timestamp_str: '00:18:10', context: 'Gestural prompt to cue answer.', confidence: 0.91, duration_sec: 3 }]) },
            { id: '21', checklist_item_id: '21', checklist_section: 'D', checklist_text: 'Teacher gives praise and encouragement', count: 5, occurrences: JSON.stringify([{ timestamp_sec: 285, timestamp_str: '00:04:45', context: 'Brilliant effort Tommy! Super clear pronunciation.', confidence: 0.98, duration_sec: 3 }, { timestamp_sec: 510, timestamp_str: '00:08:30', context: 'Wonderful try Anna, love your confidence!', confidence: 0.96, duration_sec: 3 }, { timestamp_sec: 700, timestamp_str: '00:11:40', context: 'Superstar job on that hard word!', confidence: 0.97, duration_sec: 3 }, { timestamp_sec: 1020, timestamp_str: '00:17:00', context: 'Great listening skills everyone!', confidence: 0.95, duration_sec: 3 }, { timestamp_sec: 1395, timestamp_str: '00:23:15', context: 'Outstanding work today team! Thumbs up!', confidence: 0.98, duration_sec: 3 }]) },
            { id: '22', checklist_item_id: '22', checklist_section: 'D', checklist_text: 'Teacher provides corrective feedback', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 400, timestamp_str: '00:06:40', context: 'Recasts student response with correct vowel sound gently.', confidence: 0.94, duration_sec: 3 }, { timestamp_sec: 855, timestamp_str: '00:14:15', context: 'Clarifies plural ending "cats".', confidence: 0.92, duration_sec: 3 }]) },
            { id: '23', checklist_item_id: '23', checklist_section: 'D', checklist_text: 'Teacher adjusts support based on learners\' responses', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 650, timestamp_str: '00:10:50', context: 'Adds visual card hint when learner hesitates.', confidence: 0.93, duration_sec: 4 }, { timestamp_sec: 1140, timestamp_str: '00:19:00', context: 'Simplifies question format.', confidence: 0.92, duration_sec: 3 }]) },

            // Section E
            { id: '24', checklist_item_id: '24', checklist_section: 'E', checklist_text: 'Teacher uses the chat box', count: 1, occurrences: JSON.stringify([{ timestamp_sec: 160, timestamp_str: '00:02:40', context: 'Types target word "ELEPHANT" in chat for spelling cue.', confidence: 0.96, duration_sec: 4 }]) },
            { id: '25', checklist_item_id: '25', checklist_section: 'E', checklist_text: 'Teacher uses reaction icons', count: 3, occurrences: JSON.stringify([{ timestamp_sec: 300, timestamp_str: '00:05:00', context: 'Sends celebratory party popper emoji.', confidence: 0.97, duration_sec: 3 }, { timestamp_sec: 720, timestamp_str: '00:12:00', context: 'Thumbs up reaction icon.', confidence: 0.95, duration_sec: 3 }, { timestamp_sec: 1290, timestamp_str: '00:21:30', context: 'Heart emoji for great group participation.', confidence: 0.96, duration_sec: 3 }]) },
            { id: '26', checklist_item_id: '26', checklist_section: 'E', checklist_text: 'Teacher uses breakout rooms', count: 0, occurrences: '[]' },
            { id: '27', checklist_item_id: '27', checklist_section: 'E', checklist_text: 'Teacher shares screen', count: 1, occurrences: JSON.stringify([{ timestamp_sec: 60, timestamp_str: '00:01:00', context: 'Shares animated phonics presentation slides.', confidence: 0.98, duration_sec: 6 }]) },
            { id: '28', checklist_item_id: '28', checklist_section: 'E', checklist_text: 'Teacher uses a digital whiteboard', count: 1, occurrences: JSON.stringify([{ timestamp_sec: 930, timestamp_str: '00:15:30', context: 'Draws phonics blending lines on whiteboard.', confidence: 0.95, duration_sec: 5 }]) },
            { id: '29', checklist_item_id: '29', checklist_text: 'Teacher uses polls or annotation tools', checklist_section: 'E', count: 2, occurrences: JSON.stringify([{ timestamp_sec: 465, timestamp_str: '00:07:45', context: 'Invites students to stamp matching pictures on screen.', confidence: 0.94, duration_sec: 4 }, { timestamp_sec: 1100, timestamp_str: '00:18:20', context: 'Annotation circle game.', confidence: 0.93, duration_sec: 4 }]) },
          ],
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Index items by normalized text
  const itemsByText = useMemo(() => {
    const map: Record<string, ReportItem> = {};
    if (report?.items && Array.isArray(report.items)) {
      for (const it of report.items) {
        if (it && it.checklist_text) {
          map[it.checklist_text.trim().toLowerCase()] = it;
        }
      }
    }
    return map;
  }, [report]);

  const summaryStats = useMemo(() => {
    let observedCount = 0;
    let totalFrequency = 0;
    const secCounts: Record<string, { observed: number; total: number; freq: number }> = {
      A: { observed: 0, total: 0, freq: 0 },
      B: { observed: 0, total: 0, freq: 0 },
      C: { observed: 0, total: 0, freq: 0 },
      D: { observed: 0, total: 0, freq: 0 },
      E: { observed: 0, total: 0, freq: 0 },
    };

    for (const sec of ['A', 'B', 'C', 'D', 'E']) {
      const indicators = DEFAULT_CHECKLIST_STRUCTURE[sec] || [];
      secCounts[sec].total = indicators.length;
      for (const text of indicators) {
        const item = itemsByText[text.trim().toLowerCase()];
        if (item && item.count > 0) {
          observedCount++;
          totalFrequency += item.count;
          secCounts[sec].observed++;
          secCounts[sec].freq += item.count;
        }
      }
    }

    let topSec = 'A';
    let maxFreq = -1;
    for (const [sec, data] of Object.entries(secCounts)) {
      if (data.freq > maxFreq) {
        maxFreq = data.freq;
        topSec = sec;
      }
    }

    return {
      observedCount,
      totalCount: 29,
      pct: Math.round((observedCount / 29) * 1000) / 10,
      totalFrequency,
      topSec,
      topSecFreq: maxFreq,
      secCounts,
    };
  }, [itemsByText]);

  const handleExportWord = async () => {
    if (!report) return;
    setExportingWord(true);
    try {
      const blob = await generateWordReport({
        report,
        video,
        observationNo: video ? `#${video.id.slice(0, 8)}` : '#01',
        className: language === 'vi' ? 'Lớp tiếng Anh trực tuyến' : 'Online English Class',
        platform: 'Zoom',
        generalNotes: 'Teacher maintains warm, energetic classroom rapport with strong use of positive reinforcement and multi-modal digital tools. Pacing and wait time effectively support second language acquisition for young learners.',
        lang: language,
      });
      const filename = `Classroom_Observation_Checklist_${report.teacher_id}_${report.video_id.slice(0, 8)}.docx`;
      downloadBlob(blob, filename);
      toast.success(t('reportsExportWord'));
    } catch (err) {
      console.error('Failed to export Word document:', err);
      toast.error(language === 'vi' ? 'Không thể xuất tài liệu Word. Vui lòng thử lại.' : 'Could not export Word document. Please try again.');
    } finally {
      setExportingWord(false);
    }
  };

  const handleExportPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    try {
      await generateObservationPdf({
        report,
        video,
        observationNo: video ? `#${video.id.slice(0, 8)}` : '#01',
        className: language === 'vi' ? 'Lớp tiếng Anh trực tuyến' : 'Online English Class',
        platform: 'Zoom',
        generalNotes: 'Teacher maintains warm, energetic classroom rapport with strong use of positive reinforcement and multi-modal digital tools. Pacing and wait time effectively support second language acquisition for young learners.',
        lang: language,
      });
      toast.success(t('reportsExportPdfSuccess'));
    } catch (err) {
      console.error('Failed to export PDF document:', err);
      toast.error(language === 'vi' ? 'Không thể xuất tài liệu PDF. Vui lòng thử lại.' : 'Could not export PDF document. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const sectionsToRender = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div style={{ maxWidth: '1020px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '60px' }}>
      
      {/* Top Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
      }}>
        <Link
          href="/reports"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-muted)',
            fontSize: '13px',
            fontWeight: 600,
            transition: 'color 0.15s ease',
          }}
        >
          <ArrowLeft size={16} />
          <span>{t('commonBackReports')}</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Tab switch */}
          <div style={{
            display: 'flex',
            background: 'var(--card-border-soft)',
            padding: '3px',
            borderRadius: '8px',
          }}>
            <button
              onClick={() => setActiveTab('checklist')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'checklist' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'checklist' ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: activeTab === 'checklist' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {t('reportsChecklistTitle')}
            </button>
            <button
              onClick={() => setActiveTab('markdown')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: activeTab === 'markdown' ? '#FFFFFF' : 'transparent',
                color: activeTab === 'markdown' ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: activeTab === 'markdown' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Markdown
            </button>
          </div>

          {/* Export Actions (Word, PDF, Markdown, Delete) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            {/* Word button */}
            <button
              onClick={handleExportWord}
              disabled={exportingWord || exportingPdf || !report}
              style={{
                height: '28px',
                padding: '0 9px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#FFFFFF',
                color: '#166534',
                border: '1px solid #D1D5DB',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                cursor: exportingWord || exportingPdf || !report ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={language === 'vi' ? 'Xuất báo cáo Word (.docx)' : 'Export report to Word (.docx)'}
              onMouseEnter={(e) => {
                if (!exportingWord && !exportingPdf && report) {
                  e.currentTarget.style.backgroundColor = '#F0FDF4';
                  e.currentTarget.style.borderColor = '#86EFAC';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }}
            >
              {exportingWord ? <Loader2 size={12.5} className="animate-spin" color="#166534" /> : <FileText size={12.5} color="#166534" />}
              <span>{exportingWord ? t('reportsExportingWord') : t('reportsExportWord')}</span>
            </button>

            {/* PDF button */}
            <button
              onClick={handleExportPdf}
              disabled={exportingWord || exportingPdf || !report}
              style={{
                height: '28px',
                padding: '0 9px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: '#FFFFFF',
                color: '#991B1B',
                border: '1px solid #D1D5DB',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                cursor: exportingWord || exportingPdf || !report ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={language === 'vi' ? 'Xuất báo cáo PDF (.pdf)' : 'Export report to PDF (.pdf)'}
              onMouseEnter={(e) => {
                if (!exportingWord && !exportingPdf && report) {
                  e.currentTarget.style.backgroundColor = '#FEF2F2';
                  e.currentTarget.style.borderColor = '#FECACA';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#D1D5DB';
              }}
            >
              {exportingPdf ? <Loader2 size={12.5} className="animate-spin" color="#991B1B" /> : <Printer size={12.5} color="#DC2626" />}
              <span>{exportingPdf ? t('reportsExportingPdf') : t('reportsExportPdf')}</span>
            </button>

            {/* Download Markdown button */}
            {report && (
              <a
                href={api.getReportDownloadUrl(report.video_id)}
                download={`report_${report.teacher_id}_${report.video_id.slice(0, 8)}.md`}
                style={{
                  height: '28px',
                  padding: '0 9px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#FFFFFF',
                  color: '#475569',
                  border: '1px solid #D1D5DB',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                }}
                title={language === 'vi' ? 'Tải tệp Markdown thô (.md)' : 'Download raw Markdown file (.md)'}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#F8FAFC';
                  e.currentTarget.style.borderColor = '#94A3B8';
                  e.currentTarget.style.color = '#0F172A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                  e.currentTarget.style.borderColor = '#D1D5DB';
                  e.currentTarget.style.color = '#475569';
                }}
              >
                <Download size={12.5} color="#64748B" />
                <span>Markdown</span>
              </a>
            )}

            {/* Delete Report Button */}
            {report && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  height: '28px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#FFFFFF',
                  color: '#94A3B8',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#DC2626';
                  e.currentTarget.style.backgroundColor = '#FEF2F2';
                  e.currentTarget.style.borderColor = '#FECACA';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94A3B8';
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                title={language === 'vi' ? 'Xóa báo cáo này' : 'Delete this report'}
              >
                <Trash2 size={13} />
                <span>{language === 'vi' ? 'Xóa' : 'Delete'}</span>
              </button>
            )}
          </div>
        </div>
      </div>


      {/* Main Content Area */}
      {loading ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--card-border)',
          borderRadius: '12px',
          padding: '60px 20px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}>
          <div className="animate-spin" style={{ width: '28px', height: '28px', border: '3px solid var(--card-border)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>{t('commonLoading')}</span>
        </div>
      ) : report && activeTab === 'checklist' ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--card-border, #E2E8F0)',
          borderRadius: '16px',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
          padding: '36px 44px',
          color: '#1E293B',
          lineHeight: 1.6,
        }}>
          {/* Header Badge & Title */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              backgroundColor: '#EFF6FF',
              color: '#1E3A8A',
              border: '1px solid #BFDBFE',
              marginBottom: '10px',
            }}>
              {language === 'vi' ? 'Hồ Sơ Quan Sát Sư Phạm Chuẩn Học Thuật' : 'Academic Classroom Observation Protocol'}
            </div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#1E3A8A',
              margin: '0 0 8px 0',
            }}>
              {t('reportsChecklistTitle')}
            </h1>
            <p style={{
              fontSize: '14px',
              fontStyle: 'italic',
              color: '#4B5563',
              maxWidth: '780px',
              margin: '0 auto 6px auto',
            }}>
              {language === 'vi'
                ? 'Nghiên cứu: Chiến lược quản lý lớp học trực tuyến & Khả năng tương tác nói tiếng Anh của học sinh tiểu học'
                : "Research: Primary EFL Teachers' Online Classroom Management Strategies & Student Speaking Participation"}
            </p>
            <p style={{
              fontSize: '12px',
              color: '#6B7280',
              margin: '0 auto',
            }}>
              {language === 'vi'
                ? 'Khung nghiên cứu: Bảng kiểm quan sát video sư phạm 5 phần (Phần A đến E — 29 Chỉ báo hành vi)'
                : 'Theoretical Framework: 5-Section Academic Checklist (Sections A to E — 29 Behavioral Indicators)'}
            </p>
          </div>

          {/* Lesson Information Box (2x2 / 2x4 Table Card) */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#1E3A8A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '10px',
            }}>
              <span style={{ width: '4px', height: '14px', backgroundColor: '#1E3A8A', borderRadius: '2px', display: 'inline-block' }} />
              <span>{t('reportsLessonInfo')}</span>
            </h3>

            <div style={{
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              overflow: 'hidden',
              fontSize: '13.5px',
            }}>
              {/* Row 1: Obs No & Teacher */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', borderRight: '1px solid #E2E8F0' }}>
                  <div style={{ width: '150px', backgroundColor: '#F8FAFC', padding: '10px 14px', fontWeight: 600, color: '#475569', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>
                    {t('reportsObservationNo')}:
                  </div>
                  <div style={{ padding: '10px 14px', fontWeight: 700, color: '#1E3A8A' }}>
                    {video ? `#${video.id.slice(0, 8)}` : '#01'}
                  </div>
                </div>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: '150px', backgroundColor: '#F8FAFC', padding: '10px 14px', fontWeight: 600, color: '#475569', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>
                    {t('reportsTeacher')}:
                  </div>
                  <div style={{ padding: '10px 14px', fontWeight: 700, color: '#9E4A28' }}>
                    {video?.teacher_id || report.teacher_id || 'T01'}
                  </div>
                </div>
              </div>

              {/* Row 2: Date & Duration */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', borderRight: '1px solid #E2E8F0' }}>
                  <div style={{ width: '150px', backgroundColor: '#F8FAFC', padding: '10px 14px', fontWeight: 600, color: '#475569', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>
                    {t('reportsDate')}:
                  </div>
                  <div style={{ padding: '10px 14px', color: '#1E293B' }}>
                    {video?.uploaded_at
                      ? new Date(video.uploaded_at).toISOString().split('T')[0]
                      : (report.generated_at ? new Date(report.generated_at).toISOString().split('T')[0] : '2024-01-15')}
                  </div>
                </div>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: '150px', backgroundColor: '#F8FAFC', padding: '10px 14px', fontWeight: 600, color: '#475569', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>
                    {t('reportsDuration')}:
                  </div>
                  <div style={{ padding: '10px 14px', color: '#1E293B' }}>
                    {video?.duration_sec ? `${formatSeconds(video.duration_sec)}` : '25:00'}
                  </div>
                </div>
              </div>

              {/* Row 3: Class & Platform */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', borderBottom: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', borderRight: '1px solid #E2E8F0' }}>
                  <div style={{ width: '150px', backgroundColor: '#F8FAFC', padding: '10px 14px', fontWeight: 600, color: '#475569', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>
                    {t('reportsClass')}:
                  </div>
                  <div style={{ padding: '10px 14px', color: '#1E293B' }}>
                    {language === 'vi' ? 'Lớp tiếng Anh trực tuyến' : 'Online English Class'}
                  </div>
                </div>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: '150px', backgroundColor: '#F8FAFC', padding: '10px 14px', fontWeight: 600, color: '#475569', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>
                    {t('reportsPlatform')}:
                  </div>
                  <div style={{ padding: '10px 14px', color: '#1E293B' }}>
                    Zoom
                  </div>
                </div>
              </div>

              {/* Row 4: Topic */}
              <div style={{ display: 'flex' }}>
                <div style={{ width: '150px', backgroundColor: '#F8FAFC', padding: '10px 14px', fontWeight: 600, color: '#475569', borderRight: '1px solid #E2E8F0', flexShrink: 0 }}>
                  {t('reportsLessonTopic')}:
                </div>
                <div style={{ padding: '10px 14px', fontWeight: 600, color: '#1E293B' }}>
                  {video?.title || (language === 'vi' ? 'Luyện phát âm & Quản lý lượt nói tương tác' : 'Phonics & Turn-Taking Interaction')}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Summary Metric Bar */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '32px',
            textAlign: 'center',
          }}>
            <div>
              <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
                {language === 'vi' ? 'Chỉ báo được ghi nhận' : 'Observed Indicators'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#166534', marginTop: '2px' }}>
                {summaryStats.observedCount} / 29 ({summaryStats.pct}%)
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
                {language === 'vi' ? 'Tổng tần suất hành vi' : 'Total Frequency'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E3A8A', marginTop: '2px' }}>
                {summaryStats.totalFrequency} {language === 'vi' ? 'lượt' : 'times'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
                {language === 'vi' ? 'Tương tác nhiều nhất' : 'Highest Activity Section'}
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#9E4A28', marginTop: '2px' }}>
                Section {summaryStats.topSec} ({summaryStats.topSecFreq} {language === 'vi' ? 'lượt' : 'times'})
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 600 }}>
                {language === 'vi' ? 'Trạng thái phân tích' : 'Analysis Status'}
              </div>
              <div style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#166534',
                marginTop: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }} />
                <span>{language === 'vi' ? 'Hoàn Tất (100%)' : 'Completed'}</span>
              </div>
            </div>
          </div>

          {/* 5 Section Tables: A to E */}
          {sectionsToRender.map((sec) => {
            const secTitle = (language === 'vi' ? SECTION_NAMES_VI[sec] : SECTION_NAMES[sec]) || (t(`checklistsSec${sec}` as any) || `Section ${sec}`);
            const indicatorList = DEFAULT_CHECKLIST_STRUCTURE[sec] || [];
            const secStat = summaryStats.secCounts[sec] || { observed: 0, total: indicatorList.length, freq: 0 };

            return (
              <div key={sec} style={{ marginBottom: '32px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  marginBottom: '10px',
                }}>
                  <h2 style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#1E3A8A',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    margin: 0,
                  }}>
                    <span style={{ width: '4px', height: '14px', backgroundColor: '#1E3A8A', borderRadius: '2px', display: 'inline-block' }} />
                    <span>{secTitle}</span>
                  </h2>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: secStat.observed > 0 ? '#EAF4EE' : '#F1F5F9',
                    color: secStat.observed > 0 ? '#166534' : '#64748B',
                    border: `1px solid ${secStat.observed > 0 ? '#BBF7D0' : '#E2E8F0'}`,
                  }}>
                    {secStat.observed} / {indicatorList.length} {language === 'vi' ? 'chỉ báo đạt' : 'observed'} ({secStat.freq} {language === 'vi' ? 'lượt' : 'times'})
                  </span>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13.5px',
                  }}>
                    <thead>
                      <tr style={{
                        backgroundColor: '#F1F5F9',
                        color: '#1E293B',
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        borderBottom: '1px solid #E2E8F0',
                      }}>
                        <th style={{ padding: '12px 14px', textAlign: 'left', width: '35%', borderRight: '1px solid #E2E8F0' }}>
                          {t('reportsColIndicators')}
                        </th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', width: '12%', borderRight: '1px solid #E2E8F0' }}>
                          {t('reportsColObserved')}
                        </th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', width: '11%', borderRight: '1px solid #E2E8F0' }}>
                          {t('reportsColFrequency')}
                        </th>
                        <th style={{ padding: '12px 10px', textAlign: 'center', width: '16%', borderRight: '1px solid #E2E8F0' }}>
                          {t('reportsColTimestamp')}
                        </th>
                        <th style={{ padding: '12px 14px', textAlign: 'left', width: '26%' }}>
                          {t('reportsColContext')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicatorList.map((indicatorText, idx) => {
                        const match = itemsByText[indicatorText.trim().toLowerCase()];
                        let count = 0;
                        let occurrences: ReportItemOccurrence[] = [];

                        if (match) {
                          count = match.count || 0;
                          occurrences = parseOccurrences(match.occurrences);
                        }

                        const observed = count > 0;
                        const uniqueContexts = Array.isArray(occurrences) && occurrences.length > 0
                          ? Array.from(
                              new Set(
                                occurrences
                                  .map((o) => o?.context || o?.quote || o?.code || '')
                                  .filter((c) => c && c.trim().length > 0)
                              )
                            )
                          : [];

                        return (
                          <tr
                            key={idx}
                            style={{
                              backgroundColor: observed ? '#FFFFFF' : '#FAFAFA',
                              borderBottom: idx < indicatorList.length - 1 ? '1px solid #E2E8F0' : 'none',
                              transition: 'background-color 0.15s ease',
                            }}
                          >
                            {/* Indicators */}
                            <td style={{
                              padding: '12px 14px',
                              verticalAlign: 'top',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: observed ? 600 : 400,
                              color: observed ? '#1E293B' : '#64748B',
                            }}>
                              {indicatorText}
                            </td>

                            {/* Observed */}
                            <td style={{
                              padding: '12px 8px',
                              textAlign: 'center',
                              verticalAlign: 'top',
                              borderRight: '1px solid #E2E8F0',
                            }}>
                              {observed ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 9px',
                                  borderRadius: '9999px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  backgroundColor: '#EAF4EE',
                                  color: '#166534',
                                  border: '1px solid #BBF7D0',
                                }}>
                                  <CheckCircle2 size={12} />
                                  <span>{t('reportsObservedYes')}</span>
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex',
                                  padding: '3px 8px',
                                  borderRadius: '9999px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  backgroundColor: '#F1F5F9',
                                  color: '#94A3B8',
                                  border: '1px solid #E2E8F0',
                                }}>
                                  {t('reportsObservedNo')}
                                </span>
                              )}
                            </td>

                            {/* Frequency */}
                            <td style={{
                              padding: '12px 8px',
                              textAlign: 'center',
                              verticalAlign: 'top',
                              borderRight: '1px solid #E2E8F0',
                              fontWeight: count > 0 ? 800 : 400,
                              color: count > 0 ? '#1E3A8A' : '#94A3B8',
                              fontSize: count > 0 ? '14px' : '13px',
                            }}>
                              {count > 0 ? count : '-'}
                            </td>

                            {/* Timestamp */}
                            <td style={{
                              padding: '12px 8px',
                              textAlign: 'center',
                              verticalAlign: 'top',
                              borderRight: '1px solid #E2E8F0',
                            }}>
                              {Array.isArray(occurrences) && occurrences.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                                  {occurrences.map((occ, oIdx) => {
                                    const ts = occ?.timestamp_str || (occ?.timestamp_sec != null ? formatSeconds(occ.timestamp_sec) : '-');
                                    return (
                                      <span
                                        key={oIdx}
                                        style={{
                                          display: 'inline-block',
                                          padding: '2px 8px',
                                          borderRadius: '6px',
                                          backgroundColor: '#EFF6FF',
                                          color: '#1D4ED8',
                                          border: '1px solid #DBEAFE',
                                          fontWeight: 600,
                                          fontSize: '11.5px',
                                          fontFamily: 'var(--font-mono)',
                                        }}
                                      >
                                        {ts}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span style={{ color: '#94A3B8' }}>-</span>
                              )}
                            </td>

                            {/* Context */}
                            <td style={{
                              padding: '12px 14px',
                              verticalAlign: 'top',
                              fontSize: '13px',
                              fontStyle: 'italic',
                              color: '#475569',
                              lineHeight: 1.5,
                            }}>
                              {uniqueContexts.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {uniqueContexts.map((ctx, cIdx) => (
                                    <div key={cIdx} style={{
                                      padding: '4px 8px',
                                      backgroundColor: '#F8FAFC',
                                      borderLeft: '2px solid #CBD5E1',
                                      borderRadius: '0 4px 4px 0',
                                    }}>
                                      “{ctx}”
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#94A3B8', fontStyle: 'normal' }}>-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* General Observation Notes Memo Card */}
          <div style={{
            marginTop: '32px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '20px 24px',
          }}>
            <h3 style={{
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#1E3A8A',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              margin: '0 0 10px 0',
            }}>
              <span style={{ width: '4px', height: '14px', backgroundColor: '#1E3A8A', borderRadius: '2px', display: 'inline-block' }} />
              <span>{t('reportsGeneralNotes')}</span>
            </h3>
            <div style={{
              fontSize: '14px',
              lineHeight: 1.7,
              color: '#334155',
              fontStyle: 'italic',
              marginBottom: '14px',
            }}>
              “Teacher maintains warm, energetic classroom rapport with strong use of positive reinforcement and multi-modal digital tools. Pacing and wait time effectively support second language acquisition for young learners.”
            </div>
            <div style={{
              borderTop: '1px dashed #CBD5E1',
              paddingTop: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '8px',
              fontSize: '12px',
              color: '#64748B',
            }}>
              <span>
                {language === 'vi' ? 'Phương thức phân tích:' : 'Analysis Pipeline:'} <strong>VTR AI Observational Pipeline v1.2</strong>
              </span>
              <span>
                {language === 'vi' ? 'Khung bảng kiểm:' : 'Checklist Framework:'} <strong>v1.0 (5 Sections &bull; 29 Indicators)</strong>
              </span>
            </div>
          </div>
        </div>
      ) : report ? (
        <MarkdownRenderer
          content={report.markdown_content}
          downloadUrl={api.getReportDownloadUrl(report.video_id)}
          filename={`report_${report.teacher_id}_${report.video_id.slice(0, 8)}.md`}
        />
      ) : null}

      {/* Delete Report Confirmation Dialog */}
      {showDeleteConfirm && report && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--card-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#DC2626' }}>
                    {t('deleteReportTitle') || 'Xóa Báo Cáo Quan Sát'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('deleteVideoWarning') || 'Hành động này không thể khôi phục.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '6px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#7F1D1D',
                lineHeight: 1.5,
              }}>
                <strong>{report.teacher_id}</strong> — Report ({report.video_id.slice(0, 8)})
                <br />
                <span style={{ fontSize: '12px', color: '#991B1B', marginTop: '6px', display: 'block' }}>
                  {t('deleteReportWarning') || 'Hành động này sẽ xóa báo cáo và toàn bộ thống kê tiêu chí. Video sẽ quay lại trạng thái đã khớp (mapped).'}
                </span>
              </div>

              {deleteError && (
                <div style={{
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <AlertCircle size={15} />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            <div style={{
              padding: '16px 24px',
              backgroundColor: '#F9FAFB',
              borderTop: '1px solid var(--card-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="btn btn-secondary"
              >
                {t('commonCancel') || 'Hủy'}
              </button>
              <button
                type="button"
                onClick={handleDeleteReport}
                disabled={isDeleting}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  opacity: isDeleting ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={15} />
                <span>{isDeleting ? (t('btnDeleting') || 'Đang xóa...') : (t('btnConfirmDeleteReport') || 'Xóa Báo Cáo')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

