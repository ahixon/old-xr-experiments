import { System } from "@realityshell/ecs";
import { TransformComponent } from "./components/TransformComponent";
import { WebGLAttributesComponent } from "./components/WebGLAttributesComponent";

import { mat4, vec3 } from 'gl-matrix'
import { ModelComponent } from "./components/ModelComponent";
import { Camera } from "./camera";
import { ParentComponent } from "./components/ParentComponent";

// TODO: remove this
let lightPos = [-10.0, -200, -10.0]

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

        // Compute the projection matrix
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var zNear = 1;
        var zFar = 2000;

        var projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, camera.fieldOfViewRadians, aspect, zNear, zFar);

        // Make a view matrix from the camera matrix
        const viewMatrix = mat4.create();
        mat4.invert(viewMatrix, camera.cameraMatrix);

        // Compute a view projection matrixcoat_bsdf_out.response;
        const viewProjectionMatrix = mat4.create();
        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

        for (const entity of entities.keys()) {
            const transform = world.getComponents(entity)?.get(TransformComponent)!;
            const attributes = world.getComponents(entity)?.get(WebGLAttributesComponent)!;

            const model = world.getComponents(entity)?.get(ModelComponent)!;

            gl.useProgram(model.material.program.program);

            var worldLocation = gl.getUniformLocation(model.material.program.program, "u_worldMatrix");
            var worldViewProjectionLocation = gl.getUniformLocation(model.material.program.program, "u_viewProjectionMatrix");
            var worldInverseTransposeLocation = gl.getUniformLocation(model.material.program.program, "u_worldInverseTransposeMatrix");

            for (const partName of attributes.attributesForPart.keys()) {
                const part = attributes.attributesForPart.get(partName)!;
                for (const attribName of attributes.locs.keys()) {
                    const partAttr = part[attribName];
                    if (!partAttr) {
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

                const worldViewProjectionMatrix = mat4.create();
                mat4.multiply(worldViewProjectionMatrix, viewProjectionMatrix, worldMatrix);

                gl.uniformMatrix4fv(
                    worldViewProjectionLocation, false,
                    worldViewProjectionMatrix);

                const worldInverseTransposeMatrix = mat4.create();
                const worldInverted = mat4.create();
                mat4.invert(worldInverted, worldMatrix)
                mat4.transpose(worldInverseTransposeMatrix, worldInverted)
                gl.uniformMatrix4fv(
                    worldInverseTransposeLocation, false,
                    worldInverseTransposeMatrix);

                gl.uniformMatrix4fv(worldLocation, false, worldMatrix);

                var lightTypePos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].type");
                var lightDirectionPos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].direction");

                var lightColorPos = gl.getUniformLocation(model.material.program.program, "u_lightData[0].color");
                var lightColorIntensity = gl.getUniformLocation(model.material.program.program, "u_lightData[0].intensity");

                var activeLightPos = gl.getUniformLocation(model.material.program.program, "u_numActiveLightSources");

                var viewPositionPos = gl.getUniformLocation(model.material.program.program, "u_viewPosition");

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
                    } else {
                        throw new Error('unsupported type')
                    }
                }

                // console.log(model.material.variables)

                const cameraPos = vec3.create();
                mat4.getTranslation(cameraPos, camera.cameraMatrix);
                gl.uniform1i(lightTypePos, 1) // directional
                gl.uniform3fv(lightDirectionPos, lightPos)
                gl.uniform3fv(lightColorPos, [1, 1, 1])
                gl.uniform3fv(viewPositionPos, cameraPos)
                gl.uniform1f(lightColorIntensity, 3.527)
                gl.uniform1i(activeLightPos, 1)

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