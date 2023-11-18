import { TransformComponent } from '@realityshell/engine/components/TransformComponent';

import { mat4, vec3 } from 'gl-matrix'

import { createWebGLContext } from '@realityshell/engine/context'
import { degToRad } from '@realityshell/engine/utils'
import { Entity, World } from '@realityshell/ecs';
import { compilerSystem } from '@realityshell/engine/system-compiler';
import { loadScene } from '@realityshell/loader-rssg'

///// world setup

const world = new World();

const gl = createWebGLContext({
    xrCompatible: true
});

if (!gl || !(gl instanceof WebGLRenderingContext || gl instanceof WebGL2RenderingContext)) {
    throw new Error('no gl context');
}

document.getElementById('canvas').appendChild(gl.canvas);

gl.canvas.height = document.getElementById('canvas')?.clientHeight
gl.canvas.width = document.getElementById('canvas')?.clientWidth


// import binUrl from './lab_electronics01.bin?url'
import binUrl from './pancakes.bin?url'
import { rendererSystem } from '@realityshell/engine/system-renderer';
// import binUrl from './Kitchen_set.bin?url'
const sceneBin = await (await fetch(binUrl)).arrayBuffer()
console.log(sceneBin)
// const sceneJson = (await import('./lab_electronics01.json')).default
const sceneJson = (await import('./pancakes.json')).default
// const sceneJson = (await import('./Kitchen_set.json')).default

loadScene(world, gl, sceneJson, sceneBin)

///////////////////////////////


var fieldOfViewRadians = degToRad(60);

const cameraMatrix = mat4.create();

var cameraLookAt = [
    0, 10, 20
];

var up = [0, 1, 0];
mat4.targetTo(cameraMatrix, vec3.fromValues(cameraLookAt[0], cameraLookAt[1], cameraLookAt[2]), vec3.fromValues(0, 0, 0), vec3.fromValues(up[0], up[1], up[2]))

world.addSystem(compilerSystem(world, gl));

world.addSystem({
    matchers: new Set([TransformComponent]),
    update({entities}) {
        cameraLookAt[0] -= 0.01
        cameraLookAt[2] -= 0.01
        mat4.targetTo(cameraMatrix, vec3.fromValues(cameraLookAt[0], cameraLookAt[1], cameraLookAt[2]), vec3.fromValues(0, 0, 0), vec3.fromValues(up[0], up[1], up[2]))
    }
})

world.addSystem(rendererSystem(world, gl))


const avgElem = document.getElementById('fps')!;
let frameCounter = 0;
let start = 0;

const runWorld = () => {
    world.update({
        camera: {
            cameraMatrix,
            fieldOfViewRadians
        }
    });
    const finish = performance.now();
    const time = finish - start;
    frameCounter++;

    const fps = (frameCounter / (time)) * 1000

    if (frameCounter % 60 === 0) {
        avgElem.textContent = fps.toFixed(2).toString();
    }

    // cameraPosition[0] += 0.05
    // cameraPosition[2] += 0.05
    requestAnimationFrame(runWorld);
}

function boot() {
    start = performance.now();
    requestAnimationFrame(runWorld);
}

boot()


let mousePressed = false;
let startMousePos = { x: 0, y: 0 };

// Event listeners
document.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left mouse button
        mousePressed = true;
        startMousePos = { x: event.clientX, y: event.clientY };
    }
});

document.addEventListener('mouseup', () => {
    mousePressed = false;
});

document.addEventListener('mousemove', (event) => {
    if (mousePressed) {
        const dx = event.clientX - startMousePos.x;
        const dy = event.clientY - startMousePos.y;

        mat4.rotateX(cameraMatrix, mat4.clone(cameraMatrix), degToRad(dy * 0.1))
        mat4.rotateY(cameraMatrix, mat4.clone(cameraMatrix), degToRad(dx * 0.1))

        startMousePos = { x: event.clientX, y: event.clientY };
    }
});

document.addEventListener('wheel', (event) => {
    // Adjust the camera's field of view for zooming
    fieldOfViewRadians += degToRad(event.deltaY * 0.05);
    fieldOfViewRadians = Math.max(degToRad(10), Math.min(degToRad(100), fieldOfViewRadians)); // Clamp FOV
    // camera.updateProjectionMatrix();
});