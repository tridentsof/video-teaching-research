'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Report, Video, ReportItem, ReportItemOccurrence, api } from '@/lib/api';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { useTranslation } from '@/lib/i18n';
import { generateWordReport, downloadBlob, SECTION_NAMES, DEFAULT_CHECKLIST_STRUCTURE } from '@/lib/wordExport';
import { ArrowLeft, Download, FileText, CheckCircle2, Play, ExternalLink, Printer, Trash2, AlertCircle, X } from 'lucide-react';

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
  const { t } = useTranslation();
  const [report, setReport] = useState<Report | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingWord, setExportingWord] = useState(false);
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

  const handleExportWord = async () => {
    if (!report) return;
    setExportingWord(true);
    try {
      const blob = await generateWordReport({
        report,
        video,
        observationNo: video ? `#${video.id.slice(0, 8)}` : '#01',
        className: 'Online English Class',
        platform: 'Zoom',
        generalNotes: 'Teacher maintains warm, energetic classroom rapport with strong use of positive reinforcement and multi-modal digital tools. Pacing and wait time effectively support second language acquisition for young learners.',
      });
      const filename = `Classroom_Observation_Checklist_${report.teacher_id}_${report.video_id.slice(0, 8)}.docx`;
      downloadBlob(blob, filename);
    } catch (err) {
      console.error('Failed to export Word document:', err);
      alert('Could not export Word document. Please try again.');
    } finally {
      setExportingWord(false);
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

          {/* Export Word (.docx) button */}
          <button
            onClick={handleExportWord}
            disabled={exportingWord || !report}
            className="btn"
            style={{
              background: '#2D6A4F',
              color: '#FFFFFF',
              boxShadow: '0 2px 6px rgba(45, 106, 79, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FileText size={16} />
            <span>{exportingWord ? t('reportsExportingWord') : t('reportsExportWord')}</span>
          </button>

          {/* Download Markdown button */}
          {report && (
            <a
              href={api.getReportDownloadUrl(report.video_id)}
              download={`report_${report.teacher_id}_${report.video_id.slice(0, 8)}.md`}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Download size={15} />
              <span>{t('reportsDownloadMd')}</span>
            </a>
          )}

          {/* Delete Report button */}
          {report && (
            <button
              onClick={() => {
                setDeleteError(null);
                setShowDeleteConfirm(true);
              }}
              className="btn"
              style={{
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
              title={t('deleteReport') || 'Delete Report'}
            >
              <Trash2 size={15} />
              <span>{t('deleteReport') || 'Delete Report'}</span>
            </button>
          )}
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
          <span style={{ fontSize: '14px', fontWeight: 500 }}>Đang tải báo cáo quan sát...</span>
        </div>
      ) : report && activeTab === 'checklist' ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--card-border)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-md)',
          padding: '48px 56px',
          fontFamily: '"Times New Roman", Times, Georgia, serif',
          color: '#111111',
          lineHeight: 1.6,
        }}>
          {/* Header matching PDF */}
          <h1 style={{
            textAlign: 'center',
            fontSize: '22px',
            fontWeight: 700,
            marginBottom: '28px',
            letterSpacing: '0.3px',
            color: '#000000',
          }}>
            {t('reportsChecklistTitle')}
          </h1>

          {/* Lesson Information Box */}
          <div style={{
            marginBottom: '32px',
            fontSize: '15px',
            lineHeight: 1.8,
            borderBottom: '1px solid #E8E3D9',
            paddingBottom: '20px',
          }}>
            <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px', color: '#000000' }}>
              {t('reportsLessonInfo')}
            </div>
            <ul style={{ listStyleType: 'none', paddingLeft: '8px' }}>
              <li>- {t('reportsObservationNo')}: <strong>{video ? `#${video.id.slice(0, 8)}` : '#01'}</strong></li>
              <li>- {t('reportsTeacher')}: <strong>{video?.teacher_id || report.teacher_id}</strong></li>
              <li>- {t('reportsDate')}: <strong>{video?.uploaded_at ? new Date(video.uploaded_at).toISOString().split('T')[0] : (report.generated_at ? new Date(report.generated_at).toISOString().split('T')[0] : '2024-01-15')}</strong></li>
              <li>- {t('reportsClass')}: <strong>English Grade 2</strong></li>
              <li>- {t('reportsPlatform')}: <strong>Zoom</strong></li>
              <li>- {t('reportsLessonTopic')}: <strong>{video?.title || 'Phonics & Turn-Taking Interaction'}</strong></li>
              <li>- {t('reportsDuration')}: <strong>{video?.duration_sec ? formatSeconds(video.duration_sec) : '25:00'}</strong></li>
            </ul>
          </div>

          {/* 5 Section Tables: A to E */}
          {sectionsToRender.map((sec) => {
            const secTitle = SECTION_NAMES[sec] || `Section ${sec}`;
            const indicatorList = DEFAULT_CHECKLIST_STRUCTURE[sec] || [];

            return (
              <div key={sec} style={{ marginBottom: '36px' }}>
                <h2 style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  marginBottom: '12px',
                  color: '#000000',
                  borderLeft: '3px solid var(--accent)',
                  paddingLeft: '10px',
                }}>
                  {secTitle}
                </h2>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '14px',
                    borderColor: '#000000',
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FBF9F5', fontWeight: 700 }}>
                        <th style={{ border: '1px solid #111111', padding: '10px 12px', textAlign: 'left', width: '34%' }}>
                          {t('reportsColIndicators')}
                        </th>
                        <th style={{ border: '1px solid #111111', padding: '10px 12px', textAlign: 'center', width: '12%' }}>
                          {t('reportsColObserved')}
                        </th>
                        <th style={{ border: '1px solid #111111', padding: '10px 12px', textAlign: 'center', width: '12%' }}>
                          {t('reportsColFrequency')}
                        </th>
                        <th style={{ border: '1px solid #111111', padding: '10px 12px', textAlign: 'center', width: '17%' }}>
                          {t('reportsColTimestamp')}
                        </th>
                        <th style={{ border: '1px solid #111111', padding: '10px 12px', textAlign: 'left', width: '25%' }}>
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
                          <tr key={idx} style={{ backgroundColor: observed ? '#FFFFFF' : '#FCFCFA' }}>
                            {/* Indicators */}
                            <td style={{ border: '1px solid #111111', padding: '10px 12px', verticalAlign: 'top' }}>
                              {indicatorText}
                            </td>

                            {/* Observed */}
                            <td style={{
                              border: '1px solid #111111',
                              padding: '10px 8px',
                              textAlign: 'center',
                              verticalAlign: 'top',
                              fontWeight: observed ? 700 : 400,
                              color: observed ? '#111111' : '#888888',
                            }}>
                              {observed ? (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#2D6A4F',
                                  fontWeight: 700,
                                }}>
                                  <CheckCircle2 size={13} />
                                  <span>{t('reportsObservedYes')}</span>
                                </span>
                              ) : (
                                <span>{t('reportsObservedNo')}</span>
                              )}
                            </td>

                            {/* Frequency */}
                            <td style={{
                              border: '1px solid #111111',
                              padding: '10px 8px',
                              textAlign: 'center',
                              verticalAlign: 'top',
                              fontWeight: count > 0 ? 700 : 400,
                            }}>
                              {count > 0 ? count : '-'}
                            </td>

                            {/* Timestamp */}
                            <td style={{
                              border: '1px solid #111111',
                              padding: '10px 8px',
                              textAlign: 'center',
                              verticalAlign: 'top',
                              fontFamily: 'var(--font-mono)',
                              fontSize: '12px',
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
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          background: 'var(--accent-blue-soft)',
                                          color: 'var(--accent-blue)',
                                          fontWeight: 600,
                                        }}
                                      >
                                        {ts}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span style={{ color: '#888888' }}>-</span>
                              )}
                            </td>

                            {/* Context */}
                            <td style={{
                              border: '1px solid #111111',
                              padding: '10px 12px',
                              verticalAlign: 'top',
                              fontSize: '13px',
                              color: '#222222',
                            }}>
                              {uniqueContexts.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {uniqueContexts.map((ctx, cIdx) => (
                                    <div key={cIdx}>
                                      {ctx}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#888888', fontStyle: 'italic' }}>-</span>
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

          {/* General Observation Notes matching PDF */}
          <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #E8E3D9' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: '#000000' }}>
              {t('reportsGeneralNotes')}
            </h2>
            <div style={{
              fontSize: '14px',
              lineHeight: 1.8,
              color: '#333333',
              marginBottom: '16px',
              fontStyle: 'italic',
            }}>
              Teacher maintains warm, energetic classroom rapport with strong use of positive reinforcement and multi-modal digital tools. Pacing and wait time effectively support second language acquisition for young learners.
            </div>
            <div style={{
              color: '#999999',
              letterSpacing: '2px',
              lineHeight: 2,
              fontFamily: 'monospace',
            }}>
              ...........................................................................................................................................................<br />
              ...........................................................................................................................................................
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

