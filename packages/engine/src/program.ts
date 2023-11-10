function createAndCompileShader(gl: WebGLRenderingContext | WebGL2RenderingContext, type: number, source: string) {
    var shader = gl.createShader(type);
    if (!shader) {
        throw new Error('failed to create shader')
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }

    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    throw new Error('failed to compile shader');
}

// TODO: compile based on graph

export class Program {
    program: WebGLProgram;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, vertexShaderSource: string, fragmentShaderSource: string) {
        const program = gl.createProgram();
        if (!program) {
            throw new Error('could not create program')
        }

        const vertexShader = createAndCompileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createAndCompileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);

        gl.linkProgram(program);

        // Check the link status
        const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!linked) {
            // something went wrong with the link
            const lastError = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            throw new Error('Error in program linking:' + lastError)
        }

        this.program = program;

        // const uniformSetters = createUniformSetters(gl, program);
        // const attribSetters = createAttributeSetters(gl, program);
        // return {
        //     program: program,
        //     uniformSetters: uniformSetters,
        //     attribSetters: attribSetters,
        // };
    }
}