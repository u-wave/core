declare module 'secure-json-parse' {
  namespace sjson {
    type Options = {
      protoAction?: 'error' | 'remove' | 'ignore',
      constructorAction?: 'error' | 'remove' | 'ignore',
    };
    declare function parse(text: string, reviver?: (this: any, key: string, value: any) => any, options?: Options): any;
    declare function safeParse(text: string, reviver?: (this: any, key: string, value: any) => any): any;
    declare function scan(object: any, options?: Options): any;
  }
  export = sjson;
}
