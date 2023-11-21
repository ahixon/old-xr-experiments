import { System } from "@realityshell/ecs";
import { TransformComponent } from "./components/TransformComponent";
import { WebGLAttributesComponent } from "./components/WebGLAttributesComponent";

import { mat3, mat4, vec3 } from 'gl-matrix'
import { ModelComponent } from "./components/ModelComponent";
import { Camera } from "./camera";
import { ParentComponent } from "./components/ParentComponent";

// TODO: move this
// {
//     "x": -0.7112688926164376,
//     "y": -0.4790139227525348,
//     "z": -0.5144338871083584
// }
let lightPos = [-0.7112688926164376, -10.4790139227525348, -0.5144338871083584]

export const rendererSystem = (world, gl): System<{ camera: Camera }> => ({
    matchers: new Set([TransformComponent, WebGLAttributesComponent]),
    update({entities, data: { camera }}) {
        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Turn on culling. By default backfacing triangles
        // will be culled.
        gl.enable(gl.CULL_FACE);

        // Enable the depth buffer
        gl.enable(gl.DEPTH_TEST);

        gl.depthFunc(gl.LEQUAL);

        for (const entity of entities.keys()) {
            const transform = world.getComponents(entity)?.get(TransformComponent)!;
            const attributes = world.getComponents(entity)?.get(WebGLAttributesComponent)!;

            const model = world.getComponents(entity)?.get(ModelComponent)!;

            gl.useProgram(model.material.program.program);

            var worldMatrixLocation = gl.getUniformLocation(model.material.program.program, "u_worldMatrix");
            var viewProjectionMatrixLocation = gl.getUniformLocation(model.material.program.program, "u_viewProjectionMatrix");
            var worldInverseTransposeMatrixLocation = gl.getUniformLocation(model.material.program.program, "u_worldInverseTransposeMatrix");

            for (const partName of attributes.attributesForPart.keys()) {
                const part = attributes.attributesForPart.get(partName)!;
                for (let attribName of attributes.locs.keys()) {
                    // console.log(attribName)

                    let lookupAttribName = attribName;

                    if (attribName == 'texcoord_0') {
                        lookupAttribName = 'uv';
                    }

                    const partAttr = part[lookupAttribName];
                    if (!partAttr) {
                        // console.warn('attributes for part missing', lookupAttribName, part)
                        continue;
                    }

                    const attribPointer = attributes.locs.get(attribName)!;

                    // console.log('binding', attribName, 'to', attribPointer)

                    gl.bindBuffer(gl.ARRAY_BUFFER, partAttr.glBuffer);
                    gl.enableVertexAttribArray(attribPointer);
                    gl.vertexAttribPointer(
                        attribPointer, partAttr.backingArray.components, partAttr.glComponentType, partAttr.normalize,
                        0, // b.stride || 0, 
                        0, // b.offset || 0
                    );
                }

                const indices = part['indices']
                if (indices) {
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, part['indices'].glBuffer);
                }

                const worldMatrix = mat4.clone(transform.transform);

                // FIXME: move out?
                let parent = world.getComponents(entity)?.get(ParentComponent)
                while (parent) {
                    const parentComp = world.getComponents(parent.parent)
                    const parentTransform = parentComp?.get(TransformComponent);

                    if (parentTransform) {
                        mat4.mul(worldMatrix, parentTransform.transform, worldMatrix)
                    }

                    parent = parentComp?.get(ParentComponent);
                }

                gl.uniformMatrix4fv(worldMatrixLocation, false, worldMatrix);
                gl.uniformMatrix4fv(viewProjectionMatrixLocation, false, camera.viewProjectionMatrix);

                // Extract the 3x3 upper-left submatrix from the 4x4 world matrix
                const upperLeft3x3 = mat3.create();
                mat3.fromMat4(upperLeft3x3, worldMatrix);

                // Compute the inverse of this 3x3 matrix
                const inverted3x3 = mat3.create();
                mat3.invert(inverted3x3, upperLeft3x3);

                // Compute the transpose of the inverted 3x3 matrix
                const transposed3x3 = mat3.create();
                mat3.transpose(transposed3x3, inverted3x3);

                // Expand this 3x3 matrix back to a 4x4 matrix
                const worldInverseTransposeMatrix = mat4.fromValues(
                    transposed3x3[0], transposed3x3[1], transposed3x3[2], 0,
                    transposed3x3[3], transposed3x3[4], transposed3x3[5], 0,
                    transposed3x3[6], transposed3x3[7], transposed3x3[8], 0,
                    0, 0, 0, 1
                );                

                // Pass the matrix to the shader
                gl.uniformMatrix4fv(worldInverseTransposeMatrixLocation, false, worldInverseTransposeMatrix);

                var lightTypePos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].type");
                var lightDirectionPos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].direction");

                var lightColorPos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].color");
                var lightColorIntensity = gl.getUniformLocation(model.material.program.program, "u_lightData[0].intensity");

                var activeLightPos = gl.getUniformLocation(model.material.program.program, "u_numActiveLightSources");

                var viewPositionPos = gl.getUniformLocation(model.material.program.program, "u_viewPosition");

                const envMatrixPos = gl.getUniformLocation(model.material.program.program, "u_envMatrix")
                

                let textureUnitIndex = 0;
                for (const variable of Object.keys(model.material.variables)) {
                    const type = model.material.variables[variable].type;
                    const value = model.material.variables[variable].value;

                    var uniformLocation = gl.getUniformLocation(model.material.program.program, variable);

                    if (type === 'integer') {
                        gl.uniform1i(uniformLocation, value)
                    } else if (type === 'float') {
                        gl.uniform1f(uniformLocation, value)
                    } else if (type === 'vec3float') {
                        gl.uniform3fv(uniformLocation, value)
                    } else if (type === 'matrix4float') {
                        gl.uniformMatrix4fv(uniformLocation, false, value);
                    } else if (type === 'filename') {
                        const texture = model.material.textures.get(variable);
                        if (!texture) {
                            console.warn('no texture for', variable)
                            textureUnitIndex++;
                            continue;
                        }
                        // console.log('loading texture from', variable, 'into texture unit', textureUnitIndex, 'with variable', variable)
                        gl.activeTexture(gl.TEXTURE0 + textureUnitIndex);
                        gl.bindTexture(gl.TEXTURE_2D, texture);

                        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                        // // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, s.filter);
                        // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

                        const textureLoc = gl.getUniformLocation(model.material.program.program, variable)
                        if (!textureLoc) {
                            console.warn('no texture loc for', variable);
                        }

                        gl.uniform1i(textureLoc, textureUnitIndex);
                        textureUnitIndex++;
                        // console.log('binding', variable, 'to', textureUnitIndex, texture)
                    } else {
                        throw new Error('unsupported type ' + type)
                    }
                }

                const worldPosition = mat4.getTranslation(vec3.create(), camera.cameraMatrixWorld);

                gl.uniform1i(lightTypePos, 1) // directional
                gl.uniform3fv(lightDirectionPos, lightPos)
                gl.uniform3fv(lightColorPos, [1, 1, 1])
                gl.uniform3fv(viewPositionPos, worldPosition)
                gl.uniform1f(lightColorIntensity, 1.5277600288391113)
                gl.uniform1i(activeLightPos, 1)


                gl.uniformMatrix4fv(envMatrixPos, false, [
                    6.123233995736766e-17,
                    0,
                    -1,
                    0,
                    0,
                    1,
                    0,
                    0,
                    1,
                    0,
                    6.123233995736766e-17,
                    0,
                    0,
                    0,
                    0,
                    1
                ])

                var primitiveType = gl.TRIANGLES;
                var offset = 0;

                if (!indices) {
                    const triangleCount = part['position'].backingArray.arr.length / part['position'].backingArray.components;
                    gl.drawArrays(primitiveType, offset, triangleCount);
                } else {
                    const triangleCount = indices.backingArray.arr.length;
                    gl.drawElements(primitiveType, triangleCount, gl.UNSIGNED_SHORT, 0)
                }
            }
        }
    }
})