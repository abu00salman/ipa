declare module "bplist-parser" {
  export function parseBuffer(buffer: Buffer): unknown[];
}

declare module "plist" {
  const plist: {
    parse(xml: string): any;
    build(object: unknown, options?: object): string;
  };
  export default plist;
}
