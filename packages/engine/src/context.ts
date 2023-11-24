export function createWebGL2CanvasContext(attribs: WebGLContextAttributes = {}): { canvas: HTMLCanvasElement, context: WebGL2RenderingContext | null } {
    let canvas = document.createElement('canvas');
    return { canvas: canvas, context: canvas.getContext('webgl2', attribs) }
}