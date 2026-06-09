export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateJoinUrl(host: string, port: number): string {
  return `rfd://join?host=${encodeURIComponent(host)}&port=${port}`;
}

export async function launchGame(host: string, port: number): Promise<void> {
  const url = generateJoinUrl(host, port);
  
  // Try to open with custom protocol
  const newWindow = window.open(url, '_blank');
  
  // If popup was blocked or didn't open, try alternative methods
  if (!newWindow || newWindow.closed) {
    // Fallback: set location directly
    window.location.href = url;
  }
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'text-green-400';
    case 'starting':
      return 'text-yellow-400';
    case 'stopped':
      return 'text-gray-400';
    case 'error':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
}

export function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'running':
      return 'badge-success';
    case 'starting':
      return 'badge-warning';
    case 'stopped':
      return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    case 'error':
      return 'badge-error';
    default:
      return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}