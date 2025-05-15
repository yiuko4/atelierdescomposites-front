declare module 'dxf-parser' {
  export default class DxfParser {
    constructor();
    parseSync(dxfString: string): any;
    parse(dxfString: string, callback?: (err: Error | null, dxf: any) => void): any;
  }
}
