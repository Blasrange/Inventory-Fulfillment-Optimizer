// globals.d.ts o en src/vite-env.d.ts
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

// Para importaciones de solo efectos secundarios
declare module '*.css' {
  const content: void;
  export default content;
}