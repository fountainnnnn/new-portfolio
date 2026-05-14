// Minimal ambient declaration for the dist-min build of Plotly we only use for
// imperative calls (Plotly.toImage). The full plotly.js types are handled by the
// react-plotly.js wrapper for component props.
declare module "plotly.js-dist-min" {
  const plotly: {
    toImage: (
      element: HTMLElement | string,
      options?: { format?: "png" | "jpeg" | "webp" | "svg"; width?: number; height?: number; scale?: number },
    ) => Promise<string>;
    [key: string]: unknown;
  };
  export default plotly;
}
