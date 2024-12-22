import { $ } from "bun";
import type { BunFile } from "bun";
import { dirname, join, basename, extname } from "path";
import Constants from "./constants";

type AssetsMap = Record<AssetName, { href: string, path?: string, source?: string }>;

class Assets implements IAssets {
  private assets: Record<AssetName, { href: string, path?: string, source?: string }>;
  private hrefToName: Record<string, AssetName>;
  private nameToHref: Record<AssetName, string>;
  private nameToPath: Record<AssetName, string>;

  private constructor(_assets: AssetsMap) {
    this.assets = _assets;
    this.hrefToName = Object.keys(this.assets).reduce((res, it) => {
      return { ...res, [this.assets[it as AssetName].href]: it as AssetName };
    }, {} as Record<string, AssetName>);
    this.nameToHref = Object.keys(this.assets).reduce((res, it) => {
      return { ...res, [it as AssetName]: this.assets[it as AssetName].href };
    }, {} as Record<AssetName, string>);
    this.nameToPath = {} as Record<AssetName, string>;
  }

  static init(_assets: AssetsMap): Assets {
    try {
      return new Assets(_assets);
    } catch (error) {
      console.error("Assets initialization failed:", error);
      process.exit(1);
    }
  }

  public async build() {
    await $`rm -rf generated`;

    // == pre-build
    await Bun.write('./generated/pre-build/assets.json', JSON.stringify(Object.keys(this.assets).reduce((res, it) => {
      return { ...res, [it]: this.assets[it as AssetName].href }
    }, {}), null, 2));

    await Bun.write('./generated/pre-build/constants.json', JSON.stringify(Constants, null, 2));

    // == build
    for (const it in this.assets) {
      if (this.assets[it as AssetName].source && this.assets[it as AssetName].source?.includes('.ts')) {
        const entrypoint = dirname(this.assets[it as AssetName].source!.replace(join(process.cwd(), '/src'), '')).replaceAll('/', '-').substring(1) + '-' + basename(this.assets[it as AssetName].source!, extname(this.assets[it as AssetName].source!)) + '.js';
        this.assets[it as AssetName].path = join(process.cwd(), 'generated/build', entrypoint);
        await $`bun build ${this.assets[it as AssetName].source} --outdir generated/build --target browser --entry-naming ${entrypoint} --external react-dom --external react --external sonner`;
      } 
    }

    // == post-build
    for (const it in this.assets) {
      if (this.assets[it as AssetName].source && this.assets[it as AssetName].source?.includes('.css')) {
        this.assets[it as AssetName].path = join(process.cwd(), 'generated/post-build', basename(this.assets[it as AssetName].source!));
        await $`bunx @tailwindcss/cli@next -i ${this.assets[it as AssetName].source} -o ${this.assets[it as AssetName].path}`;
      }
    }

    this.nameToPath = Object.keys(this.assets).reduce((res, it) => {
      if (this.assets[it as AssetName].path) {
        res[it as AssetName] = this.assets[it as AssetName].path!;
      }
      return res;
    }, {} as Record<AssetName, string>);
  }

  public getAsset(name: AssetName): BunFile {
    const asset = this.assets[name];
    if (!asset || !asset.path) {
      throw new Error(`Asset not found: ${name}`);
    }
    return Bun.file(asset.path);
  }

  public getLink(name: AssetName): string {
    const href = this.nameToHref[name];
    if (!href) {
      throw new Error(`Link not found for asset: ${name}`);
    }
    return href;
  }

  public hasAssetByPath(path: string): boolean {
    return !!this.hrefToName[path];
  }

  public getAssetByPath(path: string): BunFile {
    const assetKey = this.hrefToName[path];
    if (!assetKey) {
      throw new Error(`Asset not found for href: ${path}`);
    }
    return this.getAsset(assetKey);
  }

  public getAssetByName(name: string): BunFile {
    const assetName = name as AssetName;
    return this.getAsset(assetName);
  }
}

export default async function initAssets(assetsMap: AssetsMap) {
  const assets = Assets.init(assetsMap);

  await assets.build();

  return assets;
}

