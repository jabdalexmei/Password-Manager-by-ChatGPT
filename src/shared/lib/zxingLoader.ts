type ZxingBrowserModule = typeof import('@zxing/browser');

let zxingBrowserPromise: Promise<ZxingBrowserModule> | null = null;

async function loadZxingBrowser(): Promise<ZxingBrowserModule> {
  if (!zxingBrowserPromise) {
    zxingBrowserPromise = import('@zxing/browser');
  }
  return zxingBrowserPromise;
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to read QR file data.'));
    };

    reader.onerror = () => {
      reject(reader.error ?? new Error('Unable to read QR file data.'));
    };

    reader.readAsDataURL(file);
  });
}

export async function decodeQrFromImageFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  const { BrowserQRCodeReader } = await loadZxingBrowser();
  const reader = new BrowserQRCodeReader();
  const decoded = await reader.decodeFromImageUrl(dataUrl);
  return decoded.getText();
}
