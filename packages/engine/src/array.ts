export class SizedArray {
    arr: Float32Array | Uint32Array | Uint8Array;
    components: number;

    constructor(arr: Float32Array | Uint32Array | Uint8Array, components: number) {
        this.arr = arr;
        this.components = components;
    }
}