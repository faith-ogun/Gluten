declare module "utif" {
  export interface IFD {
    width: number;
    height: number;
    [key: string]: unknown;
  }
  export function decode(buf: ArrayBuffer): IFD[];
  export function decodeImage(buf: ArrayBuffer, ifd: IFD): void;
  export function toRGBA8(ifd: IFD): Uint8Array;
  const _default: {
    decode: typeof decode;
    decodeImage: typeof decodeImage;
    toRGBA8: typeof toRGBA8;
  };
  export default _default;
}
