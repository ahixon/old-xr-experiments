import { TransformComponent } from '@realityshell/engine/components/TransformComponent';
import { ModelComponent } from '@realityshell/engine/components/ModelComponent';
import { WebGLAttribute, WebGLAttributesComponent } from '@realityshell/engine/components/WebGLAttributesComponent'

import { mat4, quat, vec3, vec4 } from 'gl-matrix'
import { Program } from '@realityshell/engine/program'

import { createCubeVertices } from '@realityshell/engine/cube'
import { createF } from '@realityshell/engine/f'

import { createWebGLContext } from '@realityshell/engine/context'
import { degToRad } from '@realityshell/engine/utils'
import { World } from '@realityshell/ecs';

// Fill the buffer with colors for the 'F'.
function setColors(gl) {
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Uint8Array([
            // left column front
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,

            // top rung front
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,

            // middle rung front
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,
            200, 70, 120,

            // left column back
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,

            // top rung back
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,

            // middle rung back
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,
            80, 70, 200,

            // top
            70, 200, 210,
            70, 200, 210,
            70, 200, 210,
            70, 200, 210,
            70, 200, 210,
            70, 200, 210,

            // top rung right
            200, 200, 70,
            200, 200, 70,
            200, 200, 70,
            200, 200, 70,
            200, 200, 70,
            200, 200, 70,

            // under top rung
            210, 100, 70,
            210, 100, 70,
            210, 100, 70,
            210, 100, 70,
            210, 100, 70,
            210, 100, 70,

            // between top rung and middle
            210, 160, 70,
            210, 160, 70,
            210, 160, 70,
            210, 160, 70,
            210, 160, 70,
            210, 160, 70,

            // top of middle rung
            70, 180, 210,
            70, 180, 210,
            70, 180, 210,
            70, 180, 210,
            70, 180, 210,
            70, 180, 210,

            // right of middle rung
            100, 70, 210,
            100, 70, 210,
            100, 70, 210,
            100, 70, 210,
            100, 70, 210,
            100, 70, 210,

            // bottom of middle rung.
            76, 210, 100,
            76, 210, 100,
            76, 210, 100,
            76, 210, 100,
            76, 210, 100,
            76, 210, 100,

            // right of bottom
            140, 210, 80,
            140, 210, 80,
            140, 210, 80,
            140, 210, 80,
            140, 210, 80,
            140, 210, 80,

            // bottom
            90, 130, 110,
            90, 130, 110,
            90, 130, 110,
            90, 130, 110,
            90, 130, 110,
            90, 130, 110,

            // left side
            160, 160, 220,
            160, 160, 220,
            160, 160, 220,
            160, 160, 220,
            160, 160, 220,
            160, 160, 220]),
        gl.STATIC_DRAW);
}

///// world setup

const world = new World();

///////////////////////////////


var numFs = 5;
var radius = 200;

var fPosition = [0, 0, 0];

let mainF: undefined | number = undefined;
for (let i = 0; i < numFs; i++) {
    var angle = i * Math.PI * 2 / numFs;
    var x = Math.cos(angle) * radius;
    var y = Math.sin(angle) * radius;

    const f = world.addEntity();
    world.addComponent(f, new TransformComponent(vec3.fromValues(fPosition[0] + x, fPosition[1], fPosition[2] + y), quat.create(), vec3.create()))
    world.addComponent(f, new ModelComponent(new Map(Object.entries(createF())), null))

    if (!mainF) {
        mainF = f;
    }
}

///////////////////////////////

const gl = createWebGLContext({
    xrCompatible: true
});

if (!gl || !(gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext)) {
    throw new Error('no gl context');
}

document.body.appendChild(gl.canvas);

gl.canvas.width = 500;
gl.canvas.height = 500;

///// shader programs

var vertexShaderSource = `attribute vec4 a_position;
attribute vec4 a_color;

uniform mat4 u_matrix;

varying vec4 v_color;

void main() {
  // Multiply the position by the matrix.
  gl_Position = u_matrix * a_position;

  // Pass the color to the fragment shader.
  v_color = a_color;
}`;

var fragmentShaderSource = `precision mediump float;

// Passed in from the vertex shader.
varying vec4 v_color;

void main() {
   gl_FragColor = v_color;
}`;

var program = new Program(gl, vertexShaderSource, fragmentShaderSource);

// lookup uniforms
var matrixLocation = gl.getUniformLocation(program.program, "u_matrix");

var cameraAngleRadians = degToRad(0);
var fieldOfViewRadians = degToRad(60);

world.addSystem({
    matchers: new Set([ModelComponent]),
    update(entities) {
        for (const entity of entities) {
            const model = world.getComponents(entity)?.get(ModelComponent)!;
            const exisingAttributes = world.getComponents(entity)?.get(WebGLAttributesComponent);

            if (!exisingAttributes) {
                const attributes = Array.from(model.mesh.keys()).reduce((acc: Record<string, WebGLAttribute>, meshKey: string) => {
                    const bufferData = model.mesh.get(meshKey)!;

                    acc[meshKey] = new WebGLAttribute(gl, bufferData, meshKey === 'color' ? true : undefined);

                    return acc;
                }, {})

                world.addComponent(entity, new WebGLAttributesComponent(attributes));
            }
        }
    }
})

world.addSystem({
    matchers: new Set([TransformComponent]),
    update(entities) {
        cameraAngleRadians += degToRad(1)

        // for (const entity of entities) {
        //     if (entity !== mainF) {
        //         const transform = world.getComponents(entity)?.get(TransformComponent)!;
        //         // quat.rotateX(transform.rotation, quat.clone(transform.rotation), degToRad(0))/
        //         // console.log('scaling', transform)
        //         transform.position[0] += 0.1
        //     }
        // }
    }
})

world.addSystem({
    matchers: new Set([TransformComponent, WebGLAttributesComponent]),
    update(entities) {
        // Tell WebGL how to convert from clip space to pixels
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Turn on culling. By default backfacing triangles
        // will be culled.
        gl.enable(gl.CULL_FACE);

        // Enable the depth buffer
        gl.enable(gl.DEPTH_TEST);

        // Compute the projection matrix
        var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
        var zNear = 1;
        var zFar = 2000;
        var projectionMatrix = mat4.create();

        // Use matrix math to compute a position on a circle where
        // the camera is
        const cameraMatrix = mat4.create();
        mat4.fromYRotation(cameraMatrix, cameraAngleRadians)
        mat4.translate(cameraMatrix, mat4.clone(cameraMatrix), vec3.fromValues(0, 0, radius * 1.5))

        // Get the camera's position from the matrix we computed
        var cameraPosition = [
            cameraMatrix[12],
            cameraMatrix[13],
            cameraMatrix[14],
        ];

        var up = [0, 1, 0];

        mat4.perspective(projectionMatrix, fieldOfViewRadians, aspect, zNear, zFar);

        // Compute the camera's matrix using look at.
        const targetComponents = world.getComponents(mainF!);
        const targetTransform = targetComponents?.get(TransformComponent)!;
        mat4.targetTo(cameraMatrix, vec3.fromValues(cameraPosition[0], cameraPosition[1], cameraPosition[2]), targetTransform.position, vec3.fromValues(up[0], up[1], up[2]))

        // Make a view matrix from the camera matrix
        const viewMatrix = mat4.create();
        mat4.invert(viewMatrix, cameraMatrix);

        // Compute a view projection matrix
        const viewProjectionMatrix = mat4.create();
        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

        for (const entity of entities) {
            const transform = world.getComponents(entity)?.get(TransformComponent)!;
            const attributes = world.getComponents(entity)?.get(WebGLAttributesComponent)!;

            gl.useProgram(program.program);

            for (let i = 0; i < gl.getProgramParameter(program.program, gl.ACTIVE_ATTRIBUTES); i++) {
                const attribInfo = gl.getActiveAttrib(program.program, i);
                if (!attribInfo) {
                    continue;
                }

                const attribPointer = gl.getAttribLocation(program.program, attribInfo.name);

                const attrs = attributes.attributes[attribInfo.name.split('_')[1]]
                if (!attrs) {
                    continue
                }

                gl.bindBuffer(gl.ARRAY_BUFFER, attrs.glBuffer);
                gl.enableVertexAttribArray(attribPointer);
                gl.vertexAttribPointer(
                    attribPointer, attrs.backingArray.components, attrs.glComponentType, attrs.normalize,
                    0, // b.stride || 0, 
                    0, // b.offset || 0
                );
            }

            const matrix = mat4.create();
            mat4.translate(matrix, viewProjectionMatrix, transform.position)

            gl.uniformMatrix4fv(matrixLocation, false, matrix);

            // Draw the geometry.
            var primitiveType = gl.TRIANGLES;
            var offset = 0;
            var count = 16 * 6;
            gl.drawArrays(primitiveType, offset, count);
        }
    },
})


const runWorld = () => {
    world.update();
    requestAnimationFrame(runWorld);
}

requestAnimationFrame(runWorld);
