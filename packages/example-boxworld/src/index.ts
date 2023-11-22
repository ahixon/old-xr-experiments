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
import binUrl from './Kitchen_set.bin?url'
// import binUrl from './pancakes.bin?url'
import { mat4 } from 'gl-matrix';
import { TransformComponent } from '@realityshell/engine/components/TransformComponent';
// import binUrl from './tv_retro.bin?url'

const sceneBin = await (await fetch(binUrl)).arrayBuffer()
// const sceneJson = (await import('./pancakes.json')).default
// const sceneJson = (await import('./tv_retro.json')).default
// const sceneJson = (await import('./lab_electronics01.json')).default
const sceneJson = (await import('./Kitchen_set.json')).default

// console.log(sceneJson)

const rootEntity = loadScene(world, gl, sceneJson, sceneBin)
const rootEntityTransform = world.getComponents(rootEntity)?.get(TransformComponent)!.transform;
console.log('initial root', rootEntity, rootEntityTransform)
const rootTransform = mat4.create();
mat4.scale(rootTransform, world.getComponents(rootEntity)?.get(TransformComponent)!.transform, [0.01, 0.01, 0.01])

world.addComponent(rootEntity, new TransformComponent(rootTransform));
console.log('new root', rootTransform, world.getComponents(rootEntity))
// addEntity(world, gl, sceneJson, sceneBin, sceneJson.nodes['/pancakes/pancakes_msh'], null);

///////////////////////////////


let controls = new OrbitCameraControls(document.body);

world.addSystem(compilerSystem(world, gl));

world.addSystem(rendererSystem(world, gl))


const avgElem = document.getElementById('fps')!;
const frameTimeElem = document.getElementById('frametime')!;
let frameCounter = 0;
let start = 0;

const runWorld = () => {
    if (controls.updated) {
        requestAnimationFrame(runWorld);
        return;
    }

    const frameStart = performance.now();
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas AND the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Turn on culling. By default backfacing triangles
    // will be culled.
    gl.enable(gl.CULL_FACE);

    // Enable the depth buffer
    gl.enable(gl.DEPTH_TEST);

    gl.depthFunc(gl.LEQUAL);

    world.update({
        camera: controls,
        updatedCamera: controls.updated,
    });

    controls.updated = true;

    const finish = performance.now();
    const time = finish - start;
    const frameTime = finish - frameStart;
    frameCounter++;

    const fps = (frameCounter / (time)) * 1000

    if (frameCounter % 60 === 0) {
        avgElem.textContent = fps.toFixed(2).toString();
        frameTimeElem.textContent = frameTime.toFixed(2).toString();
    }

    requestAnimationFrame(runWorld);
}

function boot() {
    start = performance.now();
    requestAnimationFrame(runWorld);
}

boot()

document.getElementById('start-vr').addEventListener('click', () => {
    navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
        // optionalFeatures: ['bounded-floor']
    }).then((session) => {
        let xrRefSpace;

        const onXRFrame = (time, frame) => {
            let pose = frame.getViewerPose(xrRefSpace);

            let glLayer = session.renderState.baseLayer;

            gl.bindFramebuffer(gl.FRAMEBUFFER, glLayer.framebuffer);

            // Clear the canvas AND the depth buffer.
            gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
            
            // Turn on culling. By default backfacing triangles
            // will be culled.
            gl.enable(gl.CULL_FACE);

            // Enable the depth buffer
            gl.enable(gl.DEPTH_TEST);

            gl.depthFunc(gl.LEQUAL);

            for (let view of pose.views) {
                console.log('view', view)
                let viewport = glLayer.getViewport(view);
                gl.viewport(viewport.x, viewport.y,
                            viewport.width, viewport.height);

                // console.log('view.projectionMatrix', view.projectionMatrix, 'cameraMatrixWorld', view.transform.matrix);

                // FIXME: can't actually update the world twice, otherwise things like physics simulations will run twice as fast
                const cameraMatrix = view.transform.matrix;
                const cameraMatrixWorld = mat4.invert(mat4.create(), cameraMatrix);
                const viewProjectionMatrix = mat4.multiply(mat4.create(), view.projectionMatrix, cameraMatrixWorld);
                // const cameraMatrix = cameraMatrix
                world.update({
                    camera: {
                        viewProjectionMatrix,
                    },

                    updatedCamera: false,
                });
            }

            session.requestAnimationFrame(onXRFrame);
        }

        session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

        session.requestReferenceSpace('local-floor').then((refSpace) => {
            xrRefSpace = refSpace;

            // Inform the session that we're ready to begin drawing.
            session.requestAnimationFrame(onXRFrame);
        });
    });
});