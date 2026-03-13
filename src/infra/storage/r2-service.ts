import type { Env } from '../../core/config/env';

export class R2Service {
  constructor(private readonly env: Env) {}

  async putObject(key: string, value: ArrayBuffer | string): Promise<void> {
    if (!this.env.MEDIA_BUCKET) {
      throw new Error('MEDIA_BUCKET binding is missing.');
    }

    // TODO: add metadata/content-type/ACL handling.
    await this.env.MEDIA_BUCKET.put(key, value);
  }
}
