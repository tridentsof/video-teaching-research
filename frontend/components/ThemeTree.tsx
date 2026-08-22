'use client';

import React, { useState } from 'react';
import { Theme, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { Check, Edit2, Merge, ChevronDown, ChevronRight, Lock } from 'lucide-react';

interface ThemeTreeProps {
  themes: Theme[];
  onRefresh: () => void;
}

export const ThemeTree: React.FC<ThemeTreeProps> = ({ themes, onRefresh }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [expandedThemes, setExpandedThemes] = useState<Record<string, boolean>>({});
  const [editingThemeId, setEditingThemeId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeSource, setMergeSource] = useState<string>('');
  const [mergeTarget, setMergeTarget] = useState<string>('');

  const toggleExpand = (id: string) => {
    setExpandedThemes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartEdit = (th: Theme) => {
    setEditingThemeId(th.id);
    setEditName(th.name);
    setEditDesc(th.description || '');
  };

  const handleSaveEdit = async (themeId: string) => {
    try {
      await api.updateTheme(themeId, editName, editDesc, 'draft');
      setEditingThemeId(null);
      toast.success('Qualitative theme definition updated successfully', {
        title: 'Theme Saved',
      });
      onRefresh();
    } catch (err: any) {
      toast.error(`Failed to update theme: ${err.message}`, {
        title: 'Update Error',
      });
    }
  };

  const handleConfirm = async (themeId: string) => {
    try {
      await api.confirmTheme(themeId);
      toast.success('Theme validated and confirmed into Core Categories', {
        title: 'Theme Confirmed',
      });
      onRefresh();
    } catch (err: any) {
      toast.error(`Failed to confirm theme: ${err.message}`, {
        title: 'Confirmation Error',
      });
    }
  };

  const handleMergeSubmit = async () => {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) {
      toast.warning('Please select two distinct themes to merge.', {
        title: 'Selection Required',
      });
      return;
    }
    try {
      await api.mergeThemes(mergeTarget, mergeSource);
      setIsMerging(false);
      setMergeSource('');
      setMergeTarget('');
      toast.success('Themes merged into unified category with linked evidence', {
        title: 'Merge Complete',
      });
      onRefresh();
    } catch (err: any) {
      toast.error(`Merge failed: ${err.message}`, {
        title: 'Merge Error',
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button
          onClick={() => setIsMerging(!isMerging)}
          className="btn btn-secondary btn-sm"
        >
          <Merge size={14} />
          <span>{t('themesMergeBtn')}</span>
        </button>
      </div>

      {/* Merge Modal / Drawer */}
      {isMerging && (
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#FAF8F4',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('themesMergeFrom')}</span>
          <select
            value={mergeSource}
            onChange={(e) => setMergeSource(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--card-border)' }}
          >
            <option value="">{t('themesSelectSource')}</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <span style={{ fontSize: '13px', fontWeight: 600 }}>{t('themesMergeInto')}</span>
          <select
            value={mergeTarget}
            onChange={(e) => setMergeTarget(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--card-border)' }}
          >
            <option value="">{t('themesSelectTarget')}</option>
            {themes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <button onClick={handleMergeSubmit} className="btn btn-primary btn-sm">{t('themesConfirmMerge')}</button>
          <button onClick={() => setIsMerging(false)} className="btn btn-secondary btn-sm">{t('commonCancel')}</button>
        </div>
      )}

      {/* Theme Nodes List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {themes.map((th) => {
          const isExpanded = expandedThemes[th.id] ?? true;
          const isConfirmed = th.status === 'confirmed';

          return (
            <div
              key={th.id}
              style={{
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: '#FFFFFF',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {/* Node Header */}
              <div style={{
                padding: '16px 20px',
                backgroundColor: '#F4EFE6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}>
                <div
                  onClick={() => toggleExpand(th.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                >
                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <h4 style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '20px',
                    fontWeight: 400,
                    color: 'var(--text-main)',
                  }}>
                    {th.name}
                  </h4>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className={`badge ${isConfirmed ? 'badge-audio' : 'badge-neutral'}`}>
                    {isConfirmed ? t('themesConfirmedStatus') : t('themesDraftStatus')}
                  </span>

                  {!isConfirmed && (
                    <>
                      <button
                        onClick={() => handleStartEdit(th)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                        title={t('commonEdit')}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleConfirm(th.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        <Check size={13} />
                        <span>{t('themesConfirmThemeBtn')}</span>
                      </button>
                    </>
                  )}
                  {isConfirmed && <Lock size={15} color="var(--accent-green)" />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Inline Editor */}
                  {editingThemeId === th.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#FAF8F4', padding: '14px', borderRadius: 'var(--radius-sm)' }}>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--card-border)', fontSize: '14px' }}
                      />
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={2}
                        style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--card-border)', fontSize: '13px' }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleSaveEdit(th.id)} className="btn btn-primary btn-sm">{t('commonSave')}</button>
                        <button onClick={() => setEditingThemeId(null)} className="btn btn-secondary btn-sm">{t('commonCancel')}</button>
                      </div>
                    </div>
                  ) : (
                    th.description && (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {th.description}
                      </p>
                    )
                  )}

                  {/* Grounded Theory Reasoning Trace */}
                  {th.reasoning_trace && (
                    <div style={{
                      backgroundColor: 'var(--accent-soft)',
                      borderLeft: '4px solid var(--accent)',
                      padding: '12px 16px',
                      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                      fontSize: '13px',
                      fontStyle: 'italic',
                      lineHeight: 1.6,
                      color: '#4A2315',
                    }}>
                      <div style={{ fontWeight: 600, fontStyle: 'normal', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
                        {t('reasoningTrace')}
                      </div>
                      "{th.reasoning_trace}"
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
