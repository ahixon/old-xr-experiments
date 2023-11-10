import { SizedArray } from "../array";

export class WebGLAttribute {
    gl: WebGLRenderingContext | WebGL2RenderingContext;
    backingArray: SizedArray;
    glBuffer: WebGLBuffer;
    glBufferType: number;
    normalize: boolean;

    constructor(gl: WebGLRenderingContext | WebGL2RenderingContext, array: SizedArray, normalize?: boolean, bufferType: number = gl.ARRAY_BUFFER, drawType: number = gl.STATIC_DRAW) {
        this.backingArray = array;
        this.gl = gl;
        this.normalize = normalize || false;

        const buffer = gl.createBuffer()
        if (!buffer) {
            throw new Error('could not create buffer')
        }

        this.glBuffer = buffer;
        this.glBufferType = bufferType;
        gl.bindBuffer(this.glBufferType, buffer);
        gl.bufferData(this.glBufferType, this.backingArray.arr, drawType);
    }

    get glComponentType() {
        if (this.backingArray.arr instanceof Int8Array) {
            return this.gl.BYTE;
        } else if (this.backingArray.arr instanceof Uint8Array) {
            return this.gl.UNSIGNED_BYTE;
        } else if (this.backingArray.arr instanceof Int16Array) {
            return this.gl.SHORT;
        } else if (this.backingArray.arr instanceof Uint16Array) {
            return this.gl.UNSIGNED_SHORT;
        } else if (this.backingArray.arr instanceof Int32Array) {
            return this.gl.INT;
        } else if (this.backingArray.arr instanceof Uint32Array) {
            return this.gl.UNSIGNED_INT;
        } else if (this.backingArray.arr instanceof Float32Array) {
            return this.gl.FLOAT;
        }

        throw new Error('unsupported backing array type')
    }
}

export class WebGLAttributesComponent {
    attributes: Record<string, WebGLAttribute>;

    constructor(attributes: Record<string, WebGLAttribute> = {}) {
        this.attributes = attributes;
    }
}