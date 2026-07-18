import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ScanResult {
  clean: boolean;
  detail: string;
}

@Injectable()
export class ClamavScannerService {
  constructor(private readonly configService: ConfigService) {}

  async scan(params: { content: Uint8Array; contentType: string; fileName: string }): Promise<ScanResult> {
    const endpoint = this.configService.get<string>('CLAMAV_SCAN_URL');
    if (!endpoint) {
      return { clean: false, detail: 'Scanner endpoint is not configured; file remains quarantined.' };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': params.contentType,
          'X-NextWork-File-Name': encodeURIComponent(params.fileName),
        },
        body: params.content.buffer.slice(
          params.content.byteOffset,
          params.content.byteOffset + params.content.byteLength,
        ) as ArrayBuffer,
      });
      if (!response.ok) {
        return { clean: false, detail: `Scanner returned HTTP ${response.status}.` };
      }
      const result = (await response.json().catch(() => ({}))) as { clean?: unknown; detail?: unknown; threat?: unknown };
      if (result.clean === true) {
        return { clean: true, detail: typeof result.detail === 'string' ? result.detail : 'Scanner accepted file.' };
      }
      const detail =
        typeof result.threat === 'string'
          ? result.threat
          : typeof result.detail === 'string'
            ? result.detail
            : 'Scanner did not confirm this file as clean.';
      return { clean: false, detail };
    } catch (error) {
      return { clean: false, detail: `Scanner request failed: ${(error as Error).message}` };
    }
  }
}
