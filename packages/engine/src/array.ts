export class SizedArray {
    arr: Float32Array | Uint32Array | Uint8Array | Uint16Array ;
    components: number;

    constructor(arr: Float32Array | Uint32Array | Uint16Array | Uint8Array, components: number) {
        this.arr = arr;
        this.components = components;
    }
}