import { mat3, mat4, quat, vec3 } from "gl-matrix";

export class TransformComponent {
    transform: mat4;
    inverseTransform: mat4;

    constructor(transform: mat4 = mat4.create()) {
        this.transform = transform;
        this.transformBuffer = new Float32Array(transform);
        this.inverseTransform = mat4.create();
        this.updateInverseTransform();
    }

    updateInverseTransform() {
        // Extract the 3x3 upper-left submatrix from the 4x4 world matrix
        const upperLeft3x3 = mat3.fromMat4(mat3.create(), this.transform);

        // Compute the inverse of this 3x3 matrix and transpose it
        const transposed3x3 = mat3.transpose(mat3.create(), mat3.invert(mat3.create(), upperLeft3x3));

        // Expand this 3x3 matrix back to a 4x4 matrix
        const worldInverseTransposeMatrix = mat4.fromValues(
            transposed3x3[0], transposed3x3[1], transposed3x3[2], 0,
            transposed3x3[3], transposed3x3[4], transposed3x3[5], 0,
            transposed3x3[6], transposed3x3[7], transposed3x3[8], 0,
            0, 0, 0, 1
        );
        this.inverseTransform = worldInverseTransposeMatrix;
    }
}