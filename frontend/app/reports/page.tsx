'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { FileText, ArrowRight } from 'lucide-react';

export default function ReportsIndexPage() {
  const { t } = useTranslation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getVideos()
      .then((data) => {
        setVideos(data.filter((v) => v.status === 'report_generated'));
      })
      .catch(() => {
        setVideos([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h2 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '36px',
          fontWeight: 400,
          color: 'var(--accent)',
        }}>
          {t('navReports')}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          {t('reportsDesc')}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '18px',
      }}>
        {videos.map((v) => (
          <Link
            key={v.id}
            href={`/reports/${v.id}`}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-audio">{v.teacher_id}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {t('reportsVersion')}
              </span>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
              {v.title}
            </h3>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'auto',
              paddingTop: '12px',
              borderTop: '1px solid var(--card-border-soft)',
              color: 'var(--accent)',
              fontWeight: 600,
              fontSize: '13px',
            }}>
              <span>{t('reportsReadFull')}</span>
              <ArrowRight size={15} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
