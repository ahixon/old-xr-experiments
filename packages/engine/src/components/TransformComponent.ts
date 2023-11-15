import { mat4, quat, vec3 } from "gl-matrix";

export class TransformComponent {
    transform: mat4;

    constructor(transform: mat4 = mat4.create()) {
        this.transform = transform;
    }
}