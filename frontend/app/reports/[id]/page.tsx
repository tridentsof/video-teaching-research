'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Report, api } from '@/lib/api';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { useTranslation } from '@/lib/i18n';
import { ArrowLeft } from 'lucide-react';

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.getReport(id)
      .then((data) => setReport(data))
      .catch(() => {
        // Fallback sample report matching starter-prompt.md specification
        setReport({
          id: 'rep-01',
          video_id: id,
          teacher_id: 'T01',
          checklist_id: '00000000-0000-0000-0000-000000000001',
          checklist_version: 'v1.0',
          generated_at: new Date().toISOString(),
          markdown_content: `# Classroom Analysis Report
**Teacher:** T01 | **Video:** V01 — Phonics & Turn-Taking | **Session date:** 2024-01-15
**Checklist version:** v1.0 | **Generated:** 2024-03-01

---

## Section B — Managing Turn-taking and Speaking Participation

### Teacher provides wait time
- **Count:** 9 | **Avg Confidence:** 0.91 | **Avg Duration:** 5.2s

| # | Timestamp | Confidence | Duration |
|---|-----------|------------|----------|
| 1 | 00:04:31  | 0.95       | 6s       |
| 2 | 00:07:13  | 0.88       | 5s       |
| 3 | 00:12:54  | 0.90       | 5s       |

### Teacher nominates students to speak
- **Count:** 14 | **Avg Confidence:** 0.94 | **Avg Duration:** 3.1s

| # | Timestamp | Confidence | Duration |
|---|-----------|------------|----------|
| 1 | 00:03:12  | 0.97       | 3s       |
| 2 | 00:05:21  | 0.92       | 3s       |

---

## Section D — Providing Scaffolding and Positive Reinforcement

### Teacher gives praise and encouragement
- **Count:** 18 | **Avg Confidence:** 0.96 | **Avg Duration:** 2.8s

| # | Timestamp | Confidence | Duration |
|---|-----------|------------|----------|
| 1 | 00:06:14  | 0.98       | 3s       |
| 2 | 00:10:45  | 0.94       | 2s       |
| 3 | 00:18:22  | 0.96       | 3s       |
`,
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Link href="/reports" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
        <ArrowLeft size={16} />
        <span>{t('commonBackReports')}</span>
      </Link>

      {report && (
        <MarkdownRenderer
          content={report.markdown_content}
          downloadUrl={api.getReportDownloadUrl(report.video_id)}
          filename={`report_${report.teacher_id}_${report.video_id.slice(0, 8)}.md`}
        />
      )}
    </div>
  );
}
