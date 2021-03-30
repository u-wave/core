declare module 'secure-json-parse' {
  type Options = {
    protoAction?: 'error' | 'remove' | 'ignore',
    constructorAction?: 'error' | 'remove' | 'ignore',
  };
  export function parse(text: string, reviver?: (this: any, key: string, value: any) => any, options?: Options): any;
  export function safeParse(text: string, reviver?: (this: any, key: string, value: any) => any): any;
  export function scan(object: any, options?: Options): any;
}
