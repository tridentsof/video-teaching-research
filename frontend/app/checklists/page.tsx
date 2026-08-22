'use client';

import React, { useEffect, useState } from 'react';
import { Checklist, ChecklistItem, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { CheckSquare, Plus, Trash2, Save, Sparkles } from 'lucide-react';

const sectionNames: Record<string, string> = {
  A: 'Section A. Establishing Online Rules and Routines',
  B: 'Section B. Managing Turn-taking and Speaking Participation',
  C: 'Section C. Sustaining Learner Attention and Engagement',
  D: 'Section D. Providing Scaffolding and Positive Reinforcement',
  E: 'Section E. Using Digital Tools to Support Learning and Interaction',
};

export default function ChecklistPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getChecklists()
      .then(async (cls) => {
        if (cls.length > 0) {
          const detailed = await api.getChecklist(cls[0].id);
          setChecklist(detailed);
          setItems(detailed.items || []);
        }
      })
      .catch(() => {
        // Fallback default checklist
        const defaultItems: ChecklistItem[] = [
          // Section A
          { id: '1', checklist_id: '01', section: 'A', text: 'Teacher explains classroom rules', sort_order: 1 },
          { id: '2', checklist_id: '01', section: 'A', text: 'Teacher reminds students of classroom expectations', sort_order: 2 },
          { id: '3', checklist_id: '01', section: 'A', text: 'Teacher establishes lesson routines', sort_order: 3 },
          { id: '4', checklist_id: '01', section: 'A', text: 'Teacher provides clear task instructions', sort_order: 4 },
          { id: '5', checklist_id: '01', section: 'A', text: 'Teacher manages transitions between activities', sort_order: 5 },
          // Section B
          { id: '6', checklist_id: '01', section: 'B', text: 'Teacher nominates students to speak', sort_order: 1 },
          { id: '7', checklist_id: '01', section: 'B', text: 'Teacher encourages volunteers', sort_order: 2 },
          { id: '8', checklist_id: '01', section: 'B', text: 'Teacher provides wait time', sort_order: 3 },
          { id: '9', checklist_id: '01', section: 'B', text: 'Teacher encourages quieter learners', sort_order: 4 },
          { id: '10', checklist_id: '01', section: 'B', text: 'Teacher balances speaking opportunities', sort_order: 5 },
          { id: '11', checklist_id: '01', section: 'B', text: 'Teacher organises pair/group speaking tasks', sort_order: 6 },
          // Section C
          { id: '12', checklist_id: '01', section: 'C', text: 'Teacher monitors learner attention', sort_order: 1 },
          { id: '13', checklist_id: '01', section: 'C', text: 'Teacher checks understanding', sort_order: 2 },
          { id: '14', checklist_id: '01', section: 'C', text: 'Teacher asks follow-up questions', sort_order: 3 },
          { id: '15', checklist_id: '01', section: 'C', text: 'Teacher redirects distracted learners', sort_order: 4 },
          { id: '16', checklist_id: '01', section: 'C', text: 'Teacher maintains lesson pace', sort_order: 5 },
          { id: '17', checklist_id: '01', section: 'C', text: 'Teacher motivates learners to participate', sort_order: 6 },
          // Section D
          { id: '18', checklist_id: '01', section: 'D', text: 'Teacher models target language', sort_order: 1 },
          { id: '19', checklist_id: '01', section: 'D', text: 'Teacher provides sentence starters', sort_order: 2 },
          { id: '20', checklist_id: '01', section: 'D', text: 'Teacher uses prompts', sort_order: 3 },
          { id: '21', checklist_id: '01', section: 'D', text: 'Teacher gives praise and encouragement', sort_order: 4 },
          { id: '22', checklist_id: '01', section: 'D', text: 'Teacher provides corrective feedback', sort_order: 5 },
          { id: '23', checklist_id: '01', section: 'D', text: 'Teacher adjusts support based on learners\' responses', sort_order: 6 },
          // Section E
          { id: '24', checklist_id: '01', section: 'E', text: 'Teacher uses the chat box', sort_order: 1 },
          { id: '25', checklist_id: '01', section: 'E', text: 'Teacher uses reaction icons', sort_order: 2 },
          { id: '26', checklist_id: '01', section: 'E', text: 'Teacher uses breakout rooms', sort_order: 3 },
          { id: '27', checklist_id: '01', section: 'E', text: 'Teacher shares screen', sort_order: 4 },
          { id: '28', checklist_id: '01', section: 'E', text: 'Teacher uses a digital whiteboard', sort_order: 5 },
          { id: '29', checklist_id: '01', section: 'E', text: 'Teacher uses polls or annotation tools', sort_order: 6 },
        ];
        setChecklist({ id: '01', name: 'Observation Checklist', version: 'v1.0' });
        setItems(defaultItems);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleItemTextChange = (id: string, newText: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, text: newText } : it)));
  };

  const handleAddItem = (section: string) => {
    const newItem: ChecklistItem = {
      id: `new-${Date.now()}`,
      checklist_id: checklist?.id || '01',
      section,
      text: 'New classroom observation criterion',
      sort_order: items.filter((i) => i.section === section).length + 1,
    };
    setItems((prev) => [...prev, newItem]);
    toast.info(`Added new criterion to Section ${section}`);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    toast.info('Criterion removed from draft');
  };

  const handleSave = async () => {
    if (!checklist) return;
    try {
      setSaving(true);
      await api.updateChecklistItems(
        checklist.id,
        items.map((i) => ({ section: i.section, text: i.text, sort_order: i.sort_order }))
      );
      toast.success('Observation checklist updated and synced successfully!', {
        title: 'Checklist Saved',
        duration: 3500,
      });
    } catch (err: any) {
      toast.error(`Save failed: ${err.message}`, {
        title: 'Checklist Error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--card-border)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '36px',
              fontWeight: 400,
              color: 'var(--accent)',
            }}>
              {t('navChecklists')}
            </h2>
            <span className="badge badge-neutral">{t('checklistsVersionBadge')}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {t('checklistsDesc')}
          </p>
        </div>

        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save size={16} />
          <span>{saving ? t('commonSaving') : t('checklistsSaveBtn')}</span>
        </button>
      </div>

      {/* Sections List */}
      {['A', 'B', 'C', 'D', 'E'].map((sec) => {
        const secItems = items.filter((i) => i.section === sec);
        return (
          <div
            key={sec}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '22px',
                fontWeight: 400,
                color: 'var(--text-main)',
              }}>
                {sectionNames[sec] || `Section ${sec}`}
              </h3>
              <button
                onClick={() => handleAddItem(sec)}
                className="btn btn-secondary btn-sm"
              >
                <Plus size={13} />
                <span>{t('commonAddItem')}</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {secItems.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    backgroundColor: '#FAF8F4',
                    border: '1px solid var(--card-border-soft)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 14px',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    width: '24px',
                  }}>
                    {idx + 1}.
                  </span>
                  <input
                    type="text"
                    value={item.text}
                    onChange={(e) => handleItemTextChange(item.id, e.target.value)}
                    style={{
                      flex: 1,
                      border: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '13.5px',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-subtle)', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
