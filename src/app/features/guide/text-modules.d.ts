// Exemplos importados como texto: o app mostra os mesmos arquivos de examples/.
declare module '*.ino' {
  const content: string;
  export default content;
}
declare module '*.py' {
  const content: string;
  export default content;
}
declare module '*.c' {
  const content: string;
  export default content;
}
declare module '*.mjs' {
  const content: string;
  export default content;
}
