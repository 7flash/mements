import { PinataSDK } from "pinata";
import Config from "./config";

import ShortUniqueId from "short-unique-id";
const { randomUUID } = new ShortUniqueId({ length: 10 });

export default class Files implements IFiles {
  private pinata: PinataSDK;
  private urlCache: Map<string, { url: string, expires: number }>;

  private constructor() {
    this.pinata = new PinataSDK({
      pinataJwt: Config.get('PINATA_JWT'),
      pinataGateway: Config.get('PINATA_GATEWAY_URL'),
    });
    this.urlCache = new Map();
  }

  static init(): Files {
    try {
      return new Files();
    } catch (error) {
      console.error("Files initialization failed:", error);
      process.exit(1);
    }
  }

  async upload(file: File): Promise<string> {
    try {
      const uploadData = await this.pinata.upload.file(file);
      return uploadData.cid;
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  }

  async getUrl(cid: string, expires: number): Promise<string> {
    const cached = this.urlCache.get(cid);
    if (cached && cached.expires > Date.now()) {
      return cached.url;
    }

    try {
      const url = await this.pinata.gateways.createSignedURL({
        cid: cid,
        expires: expires,
      });
      this.urlCache.set(cid, { url, expires: Date.now() + expires * 1000 });
      return url;
    } catch (error) {
      console.error("Error creating signed URL:", error);
      throw error;
    }
  }

  async createTemporaryAdminKey() {
    try {
      const keyData = await this.pinata.keys.create({
        keyName: randomUUID(),
        permissions: {
          admin: true,
        },
        maxUses: 1,
      });
      return keyData;
    } catch (error) {
      console.error("Error creating admin key:", error);
      throw error;
    }
  }
}