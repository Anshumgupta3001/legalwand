/**
 * exportChatToPdf — sends messages to the backend puppeteer endpoint,
 * receives a PDF blob, and triggers a browser download.
 *
 * Returns a Promise that resolves when the download is triggered,
 * or rejects on network / server error — callers should show feedback.
 */
import { pdfAPI } from '../services/api';

export const exportChatToPdf = async (messages, userName = '') => {
  const res  = await pdfAPI.export(messages, userName);
  const blob = res.data instanceof Blob
    ? res.data
    : new Blob([res.data], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href     = url;
  a.download = `chat-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
