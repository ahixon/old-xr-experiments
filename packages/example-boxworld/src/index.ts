import { createWebGLContext } from '@realityshell/engine/context'
import { World } from '@realityshell/ecs';
import { compilerSystem } from '@realityshell/engine/system-compiler';
import { loadScene } from '@realityshell/loader-rssg'
import { OrbitCameraControls } from '@realityshell/camera-controls';
import { rendererSystem } from '@realityshell/engine/system-renderer';

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
// import binUrl from './Kitchen_set.bin?url'
import binUrl from './pancakes.bin?url'

const sceneBin = await (await fetch(binUrl)).arrayBuffer()
const sceneJson = (await import('./pancakes.json')).default
// const sceneJson = (await import('./lab_electronics01.json')).default
// const sceneJson = (await import('./Kitchen_set.json')).default

loadScene(world, gl, sceneJson, sceneBin)

///////////////////////////////


const controls = new OrbitCameraControls(document.body);

world.addSystem(compilerSystem(world, gl));

world.addSystem(rendererSystem(world, gl))


const avgElem = document.getElementById('fps')!;
let frameCounter = 0;
let start = 0;

const runWorld = () => {
    world.update({
        camera: controls
    });

    const finish = performance.now();
    const time = finish - start;
    frameCounter++;

    const fps = (frameCounter / (time)) * 1000

    if (frameCounter % 60 === 0) {
        avgElem.textContent = fps.toFixed(2).toString();
    }

    requestAnimationFrame(runWorld);
}

function boot() {
    start = performance.now();
    requestAnimationFrame(runWorld);
}

boot()