import type { TodoBackup } from './backup';

export type PickedBackupFile = {
  content: string;
  fileName: string;
  size?: number;
};

export async function exportBackupFile(
  backup: TodoBackup,
  fileName: string,
): Promise<boolean> {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.download = fileName;
  link.href = url;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  return true;
}

export function pickBackupFile(): Promise<PickedBackupFile | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    let settled = false;

    input.accept = '.json,application/json,text/json';
    input.type = 'file';

    const finish = (result: PickedBackupFile | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', handleWindowFocus);
      input.remove();
      resolve(result);
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 300);
    };

    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0];
        if (!file) {
          finish(null);
          return;
        }

        void file
          .text()
          .then((content) =>
            finish({ content, fileName: file.name, size: file.size }),
          )
          .catch((error: unknown) => {
            settled = true;
            window.removeEventListener('focus', handleWindowFocus);
            input.remove();
            reject(error);
          });
      },
      { once: true },
    );

    window.addEventListener('focus', handleWindowFocus, { once: true });
    input.click();
  });
}
