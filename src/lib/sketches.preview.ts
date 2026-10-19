export type PreviewFormat = { kind: 'image' | 'pdf' | 'audio' | 'video' | 'text'; mime: string };

export function sketchPreviewFormat(name: string): PreviewFormat | null {
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() ?? '' : '';
  const images: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp', svg: 'image/svg+xml' };
  const audio: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac' };
  const video: Record<string, string> = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
  if (images[extension]) return { kind: 'image', mime: images[extension] };
  if (extension === 'pdf') return { kind: 'pdf', mime: 'application/pdf' };
  if (audio[extension]) return { kind: 'audio', mime: audio[extension] };
  if (video[extension]) return { kind: 'video', mime: video[extension] };
  if (['txt', 'md', 'json', 'csv', 'log', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'tsx', 'jsx', 'yaml', 'yml', 'ini', 'toml', 'sql', 'py', 'sh'].includes(extension)) return { kind: 'text', mime: 'text/plain' };
  return null;
}