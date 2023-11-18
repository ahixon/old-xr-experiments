import { mat4 } from "gl-matrix";

export type Camera = {
    fieldOfViewRadians: number;
    cameraMatrix: mat4;
}