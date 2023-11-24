import { vec3 } from "gl-matrix";

export class UnlitMaterial {
    color: vec3;

    constructor(color: vec3 = vec3.fromValues(1, 0, 0)) {
        this.color = color;
    }
}