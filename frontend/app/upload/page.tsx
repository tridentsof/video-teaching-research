'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { UploadCloud, Video, AlertCircle, ArrowLeft, Scissors, Film, Check } from 'lucide-react';
import Link from 'next/link';

import { useUpload } from '@/lib/uploadContext';

export default function UploadPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { startUpload } = useUpload();

  const [teacherId, setTeacherId] = useState('T01');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [enableChunking, setEnableChunking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const getVideoDuration = (videoFile: File): Promise<number> => {
    return new Promise((resolve) => {
      try {
        const videoElem = document.createElement('video');
        videoElem.preload = 'metadata';
        videoElem.onloadedmetadata = () => {
          window.URL.revokeObjectURL(videoElem.src);
          resolve(Math.round(videoElem.duration) || 0);
        };
        videoElem.onerror = () => resolve(0);
        videoElem.src = URL.createObjectURL(videoFile);
      } catch {
        resolve(0);
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      const msg = 'Please choose an MP4 video file.';
      setError(msg);
      toast.warning(msg, { title: 'File Missing' });
      return;
    }
    if (!teacherId) {
      const msg = 'Please specify the Teacher ID.';
      setError(msg);
      toast.warning(msg, { title: 'Teacher ID Required' });
      return;
    }

    setError(null);
    const measuredDuration = await getVideoDuration(file);

    // Start streaming upload via background XHR
    startUpload({
      teacherId,
      title,
      file,
      durationSec: measuredDuration,
      enableChunking,
    }).catch((err) => {
      console.error('Background upload failed:', err);
    });

    toast.info(`Uploading "${title || file.name}". Starting real-time analysis...`, {
      title: 'Upload Started',
      duration: 3000,
    });

    // Instant transition to live progress screen!
    router.push('/videos/uploading');
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
        <ArrowLeft size={16} />
        <span>{t('commonBackVideos')}</span>
      </Link>

      <div>
        <h2 style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '36px',
          fontWeight: 400,
          color: 'var(--accent)',
        }}>
          {t('uploadNewLesson')}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          {t('uploadDesc')}
        </p>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#FEF2F2',
          border: '1px solid #F87171',
          borderRadius: 'var(--radius-sm)',
          color: '#991B1B',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '32px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
      }}>
        {/* Teacher ID */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
            {t('uploadTeacherId')}
          </label>
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--card-border)',
              backgroundColor: '#FFFFFF',
              fontSize: '14px',
            }}
          >
            {Array.from({ length: 12 }, (_, i) => {
              const num = String(i + 1).padStart(2, '0');
              return <option key={num} value={`T${num}`}>{`Teacher T${num}`}</option>;
            })}
          </select>
        </div>

        {/* Title */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
            {t('uploadLessonTitle')}
          </label>
          <input
            type="text"
            placeholder={t('uploadTitlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--card-border)',
              backgroundColor: '#FFFFFF',
              fontSize: '14px',
            }}
          />
        </div>

        {/* File Dropzone */}
        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>
            {t('uploadVideoFile')}
          </label>
          <div style={{
            border: '2px dashed var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: '#FAF8F4',
            cursor: 'pointer',
            position: 'relative',
          }}>
            <input
              type="file"
              accept="video/mp4,video/*"
              onChange={handleFileChange}
              style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
            />
            <UploadCloud size={36} color="var(--accent)" style={{ margin: '0 auto 10px' }} />
            <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>
              {file ? file.name : t('uploadDropPrompt')}
            </p>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : t('uploadDropSub')}
            </span>
          </div>
        </div>

        {/* Chunking Strategy Option */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontWeight: 600, fontSize: '13px' }}>
              {t('uploadProcessingMode')}
            </label>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {t('uploadChooseMode')}
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
          }}>
            {/* Option 1: Single Full Video (Default) */}
            <div
              onClick={() => setEnableChunking(false)}
              style={{
                border: `1.5px solid ${!enableChunking ? 'var(--accent)' : 'var(--card-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                backgroundColor: !enableChunking ? '#FFFDF9' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: !enableChunking ? '0 0 0 1px var(--accent)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `2px solid ${!enableChunking ? 'var(--accent)' : '#D1D5DB'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {!enableChunking && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                    <Film size={14} color="var(--accent)" />
                    <span>{t('uploadModeFull')}</span>
                  </div>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#DCFCE7',
                  color: '#166534',
                }}>
                  {t('uploadRecommended')}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', margin: '2px 0 0 26px' }}>
                {t('uploadModeFullDesc')}
              </p>
            </div>

            {/* Option 2: Segmented Slicing (Preview Feature) */}
            <div
              onClick={() => setEnableChunking(true)}
              style={{
                border: `1.5px solid ${enableChunking ? 'var(--accent)' : 'var(--card-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                backgroundColor: enableChunking ? '#FFFDF9' : '#FFFFFF',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: enableChunking ? '0 0 0 1px var(--accent)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: `2px solid ${enableChunking ? 'var(--accent)' : '#D1D5DB'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {enableChunking && (
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                    <Scissors size={14} color="#736B63" />
                    <span>{t('uploadModeSplit')}</span>
                  </div>
                </div>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#FEF3C7',
                  color: '#92400E',
                  border: '1px solid #FDE68A',
                }}>
                  {t('uploadPreview')}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', margin: '2px 0 0 26px' }}>
                {t('uploadModeSplitDesc')}
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: '12px 24px', width: '100%', marginTop: '8px' }}
        >
          <Video size={16} />
          <span>{t('uploadBtnSubmit')}</span>
        </button>
      </form>
    </div>
  );
}
