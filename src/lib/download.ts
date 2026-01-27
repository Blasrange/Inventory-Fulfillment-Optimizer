'use client';

export function downloadFile(base64Data: string, fileName: string, mimeType: string) {
  const linkSource = `data:${mimeType};base64,${base64Data}`;
  const downloadLink = document.createElement('a');
  document.body.appendChild(downloadLink); // Required for Firefox
  downloadLink.href = linkSource;
  downloadLink.download = fileName;
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
