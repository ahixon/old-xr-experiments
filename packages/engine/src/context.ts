export function createWebGLContext(attribs: object = {}) {
    let canvas = document.createElement('canvas');
    let contextTypes = ['webgl2', 'webgl', 'experimental-webgl'];
    let context = null;

    for (let contextType of contextTypes) {
        context = canvas.getContext(contextType, attribs);
        if (context) {
            break;
        }
    }

    return context;
}