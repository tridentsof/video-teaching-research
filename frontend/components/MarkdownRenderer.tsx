'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { Download, Printer, Copy, Check } from 'lucide-react';

interface MarkdownRendererProps {
  content: string;
  downloadUrl?: string;
  filename?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  downloadUrl,
  filename = 'report.md',
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = React.useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Report markdown copied to clipboard', {
        title: 'Copied',
        duration: 2500,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
      toast.success('Downloading report file...', { title: 'Export Started' });
      return;
    }

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filename} successfully`, {
      title: 'Report Downloaded',
      duration: 3000,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Top Action Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '10px',
      }}>
        <button
          onClick={handleCopy}
          className="btn btn-secondary btn-sm"
          title="Copy markdown text to clipboard"
        >
          {copied ? <Check size={15} color="var(--success, #059669)" /> : <Copy size={15} />}
          <span>{copied ? 'Copied' : 'Copy Text'}</span>
        </button>
        <button
          onClick={handleDownload}
          className="btn btn-secondary btn-sm"
        >
          <Download size={15} />
          <span>{t('exportMarkdown')}</span>
        </button>
        <button
          onClick={handlePrint}
          className="btn btn-secondary btn-sm"
        >
          <Printer size={15} />
          <span>{t('printPDF')}</span>
        </button>
      </div>

      {/* Rendered Academic Markdown Article */}
      <article style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '36px 42px',
        boxShadow: 'var(--shadow-sm)',
        lineHeight: 1.65,
      }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children }) => (
              <h1 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '32px',
                fontWeight: 400,
                color: 'var(--accent)',
                marginBottom: '16px',
                borderBottom: '1px solid var(--card-border)',
                paddingBottom: '12px',
              }}>
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '24px',
                fontWeight: 400,
                color: 'var(--text-main)',
                marginTop: '28px',
                marginBottom: '14px',
                borderBottom: '1px dashed var(--card-border)',
                paddingBottom: '8px',
              }}>
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-main)',
                marginTop: '20px',
                marginBottom: '8px',
              }}>
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p style={{ marginBottom: '12px', color: '#2C2621' }}>
                {children}
              </p>
            ),
            table: ({ children }) => (
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                margin: '16px 0 24px 0',
                fontSize: '13px',
              }}>
                {children}
              </table>
            ),
            thead: ({ children }) => (
              <thead style={{
                backgroundColor: '#F4EFE6',
                borderBottom: '2px solid var(--card-border)',
              }}>
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th style={{
                padding: '10px 14px',
                textAlign: 'left',
                fontWeight: 700,
                color: 'var(--text-main)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
              }}>
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--card-border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
              }}>
                {children}
              </td>
            ),
            hr: () => (
              <hr style={{
                border: 'none',
                borderTop: '1px solid var(--card-border)',
                margin: '28px 0',
              }} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
};
