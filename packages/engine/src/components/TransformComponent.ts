import { quat, vec3 } from "gl-matrix";

export class TransformComponent {
    position: vec3;
    rotation: quat;
    scale: vec3;

    constructor(position: vec3 = vec3.fromValues(0, 0, 0), rotation: quat = quat.create(), scale: vec3 = vec3.fromValues(1, 1, 1)) {
        this.position = position
        this.rotation = rotation;
        this.scale = scale;
    }
}