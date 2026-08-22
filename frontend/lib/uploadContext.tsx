'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { api, Video } from '@/lib/api';

export interface UploadProgress {
  uploadId: string;
  teacherId: string;
  title: string;
  fileName: string;
  fileSize: number;
  loadedBytes: number;
  totalBytes: number;
  percentage: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  status: 'uploading' | 'server_processing' | 'pipeline_started' | 'completed' | 'cancelled' | 'error';
  videoId?: string;
  errorMessage?: string;
  enableChunking: boolean;
}

interface UploadContextType {
  activeUpload: UploadProgress | null;
  startUpload: (params: {
    teacherId: string;
    title: string;
    file: File;
    durationSec?: number;
    enableChunking: boolean;
  }) => Promise<string>;
  cancelUpload: () => void;
  clearUpload: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUpload, setActiveUpload] = useState<UploadProgress | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const clearUpload = useCallback(() => {
    setActiveUpload(null);
  }, []);

  const cancelUpload = useCallback(() => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setActiveUpload((prev) => (prev ? { ...prev, status: 'cancelled', errorMessage: 'Upload cancelled by user' } : null));
  }, []);

  const startUpload = useCallback(
    async ({
      teacherId,
      title,
      file,
      durationSec,
      enableChunking,
    }: {
      teacherId: string;
      title: string;
      file: File;
      durationSec?: number;
      enableChunking: boolean;
    }): Promise<string> => {
      const uploadId = `upl-${Date.now()}`;
      const resolvedTitle = title.trim() || file.name.replace(/\.[^/.]+$/, '');

      // Initialize upload state immediately
      setActiveUpload({
        uploadId,
        teacherId,
        title: resolvedTitle,
        fileName: file.name,
        fileSize: file.size,
        loadedBytes: 0,
        totalBytes: file.size,
        percentage: 0,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        status: 'uploading',
        enableChunking,
      });

      return new Promise<string>((resolve, reject) => {
        const formData = new FormData();
        formData.append('teacher_id', teacherId);
        formData.append('title', resolvedTitle);
        formData.append('file', file);
        if (durationSec && durationSec > 0) {
          formData.append('duration_sec', String(durationSec));
        }

        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
        xhr.open('POST', `${API_BASE}/videos/upload`, true);

        // Attach Authorization header if token exists
        if (typeof window !== 'undefined') {
          const token = localStorage.getItem('vtr_token');
          if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
        }

        const startTime = Date.now();
        let smoothedSpeed = 0;
        let lastLoaded = 0;
        let lastTime = startTime;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            const now = Date.now();
            const timeDelta = (now - lastTime) / 1000;
            const bytesDelta = e.loaded - lastLoaded;

            if (timeDelta >= 0.2 && bytesDelta > 0) {
              const instantSpeed = bytesDelta / timeDelta;
              // Exponential moving average for smooth speed readout
              smoothedSpeed = smoothedSpeed === 0 ? instantSpeed : smoothedSpeed * 0.7 + instantSpeed * 0.3;
              lastLoaded = e.loaded;
              lastTime = now;
            } else if (smoothedSpeed === 0 && now - startTime > 300) {
              // Fallback average speed since start
              const totalElapsed = (now - startTime) / 1000;
              if (totalElapsed > 0) {
                smoothedSpeed = e.loaded / totalElapsed;
              }
            }

            const rawPct = Math.round((e.loaded / e.total) * 100);
            const isClientDone = e.loaded >= e.total;
            const pct = isClientDone ? 100 : Math.min(rawPct, 99);
            const remainingBytes = Math.max(0, e.total - e.loaded);
            const eta = smoothedSpeed > 0 ? Math.ceil(remainingBytes / smoothedSpeed) : 0;

            setActiveUpload((prev) => {
              if (!prev || prev.uploadId !== uploadId || prev.status === 'cancelled') return prev;
              return {
                ...prev,
                loadedBytes: e.loaded,
                totalBytes: e.total,
                percentage: pct,
                speedBytesPerSec: Math.round(smoothedSpeed),
                etaSeconds: eta,
                status: isClientDone ? 'server_processing' : 'uploading',
              };
            });
          }
        };

        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const video: Video = JSON.parse(xhr.responseText);

              setActiveUpload((prev) => {
                if (!prev || prev.uploadId !== uploadId || prev.status === 'cancelled') return prev;
                return {
                  ...prev,
                  loadedBytes: file.size,
                  totalBytes: file.size,
                  percentage: 100,
                  status: 'server_processing',
                  videoId: video.id,
                };
              });

              // Auto-trigger pipeline on upload completion
              try {
                await api.triggerPipeline(video.id, undefined, enableChunking);
              } catch (pipelineErr) {
                console.warn('Auto-trigger pipeline returned:', pipelineErr);
              }

              setActiveUpload((prev) => {
                if (!prev || prev.uploadId !== uploadId || prev.status === 'cancelled') return prev;
                return {
                  ...prev,
                  percentage: 100,
                  status: 'pipeline_started',
                  videoId: video.id,
                };
              });

              xhrRef.current = null;
              resolve(video.id);
            } catch (err: any) {
              const errMsg = 'Failed to parse upload response';
              setActiveUpload((prev) => (prev && prev.status !== 'cancelled' ? { ...prev, status: 'error', errorMessage: errMsg } : prev));
              xhrRef.current = null;
              reject(new Error(errMsg));
            }
          } else {
            let errMsg = `Upload failed with HTTP ${xhr.status}`;
            try {
              const json = JSON.parse(xhr.responseText);
              if (json.error) errMsg = json.error;
            } catch {
              // ignore
            }
            setActiveUpload((prev) => (prev && prev.status !== 'cancelled' ? { ...prev, status: 'error', errorMessage: errMsg } : prev));
            xhrRef.current = null;
            reject(new Error(errMsg));
          }
        };

        xhr.onerror = () => {
          setActiveUpload((prev) => {
            if (!prev || prev.status === 'cancelled') return prev;
            return { ...prev, status: 'error', errorMessage: 'Network error during video upload' };
          });
          xhrRef.current = null;
          reject(new Error('Network error'));
        };

        xhr.onabort = () => {
          xhrRef.current = null;
          setActiveUpload((prev) => (prev ? { ...prev, status: 'cancelled', errorMessage: 'Upload cancelled by user' } : null));
          reject(new Error('Upload aborted'));
        };

        xhr.send(formData);
      });
    },
    []
  );

  return (
    <UploadContext.Provider value={{ activeUpload, startUpload, cancelUpload, clearUpload }}>
      {children}
    </UploadContext.Provider>
  );
};

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}
