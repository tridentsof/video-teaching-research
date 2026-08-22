'use client';

import React, { useState } from 'react';
import { RawEvent } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { Search, Eye, Volume2, Sparkles } from 'lucide-react';

interface EventTimelineProps {
  events: RawEvent[];
}

function formatHHMMSS(sec: number): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredEvents = events.filter((e) => {
    const matchesType = filterType === 'all' || e.event_type === filterType;
    const matchesSearch =
      searchTerm === '' ||
      e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.event_key.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Search & Filter Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          minWidth: '220px',
        }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder={t('timelineSearchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--card-border)',
              backgroundColor: '#FFFFFF',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[
            { key: 'all', label: t('filterAll') },
            { key: 'visual', label: t('filterVisual'), icon: Eye },
            { key: 'audio', label: t('filterAudio'), icon: Volume2 },
            { key: 'context', label: t('filterContext'), icon: Sparkles },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setFilterType(item.key)}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: filterType === item.key ? 'var(--accent)' : '#FAF8F4',
                color: filterType === item.key ? '#FFFFFF' : 'var(--text-muted)',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: filterType === item.key ? 'var(--accent)' : 'var(--card-border)',
                transition: 'all 0.15s ease',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxHeight: '480px',
        overflowY: 'auto',
        paddingRight: '6px',
      }}>
        {filteredEvents.length === 0 ? (
          <div style={{
            padding: '36px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            backgroundColor: '#FAF8F4',
            borderRadius: 'var(--radius-sm)',
            border: '1px dashed var(--card-border)',
          }}>
            {t('timelineNoEvents')}
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const badgeClass =
              evt.event_type === 'visual'
                ? 'badge-visual'
                : evt.event_type === 'audio'
                ? 'badge-audio'
                : 'badge-context';

            const confPercent = evt.confidence ? Math.round(evt.confidence * 100) : 95;

            return (
              <div
                key={evt.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '75px 80px 1fr 65px',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: '#FAF8F4',
                  border: '1px solid #EFEAE1',
                  fontSize: '13px',
                }}
              >
                {/* Timestamp */}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--accent-blue)',
                }}>
                  {formatHHMMSS(evt.timestamp_sec)}
                </span>

                {/* Badge */}
                <span className={`badge ${badgeClass}`}>
                  {evt.event_type}
                </span>

                {/* Description */}
                <div>
                  <strong style={{ color: 'var(--text-main)', marginRight: '6px' }}>
                    {evt.event_key}
                  </strong>
                  <span style={{ color: 'var(--text-muted)' }}>
                    — {evt.description}
                  </span>
                </div>

                {/* Confidence Metric */}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--accent-green)',
                  textAlign: 'right',
                }}>
                  {confPercent}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
