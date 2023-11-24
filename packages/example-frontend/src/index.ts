import { createWebGL2CanvasContext } from '@realityshell/engine/context'
import { World } from '@realityshell/ecs';
import { OrbitCameraControls } from '@realityshell/camera-controls';
import { mat4, vec3 } from 'gl-matrix';

import { TransformComponent } from '@realityshell/engine/components/TransformComponent';
import { ModelComponent } from '@realityshell/engine/components/ModelComponent';
import { MeshData } from '@realityshell/engine/mesh';
import { Renderer } from '@realityshell/engine/renderer';
import { UnlitMaterial } from '@realityshell/engine/materials/unlit-material';

// import { loadScene } from '@realityshell/loader-rssg'

const world = new World();

const { canvas, context: gl } = createWebGL2CanvasContext({
    xrCompatible: true
} as WebGLContextAttributes);

if (!gl) {
    throw new Error('no webgl2 context');
}

document.getElementById('canvas')!.appendChild(canvas);

canvas.height = document.getElementById('canvas')?.clientHeight || 0
canvas.width = document.getElementById('canvas')?.clientWidth || 0

// const env = 'Kitchen_set'

// const sceneBin = await (await fetch(`./${env}.bin`)).arrayBuffer()
// const sceneJson = await ((await fetch(`./${env}.json`)).json())

// const rootEntity = loadScene(world, gl, sceneJson, sceneBin)
// const rootEntityTransform = world.getComponents(rootEntity)?.get(TransformComponent)!.transform;
// console.log('initial root', rootEntity, rootEntityTransform)
// const rootTransform = mat4.create();
// mat4.scale(rootTransform, world.getComponents(rootEntity)?.get(TransformComponent)!.transform, [0.01, 0.01, 0.01])
// // mat4.scale(rootTransform, world.getComponents(rootEntity)?.get(TransformComponent)!.transform, [0.1, 0.1, 0.1])

// world.addComponent(rootEntity, new TransformComponent(rootTransform));
// console.log('new root', rootTransform, world.getComponents(rootEntity))

const cubeMesh = MeshData.createCube(0.5);
// const cubeMaterial = new ShaderGraphMaterial();
const cubeMaterial = new UnlitMaterial(vec3.fromValues(1, 0, 0));

const cubeEntity = world.createEntity();
cubeEntity.addComponent(new TransformComponent(mat4.create()));
cubeEntity.addComponent(new ModelComponent(cubeMesh, [cubeMaterial]));

///////////////////////////////

let controls = new OrbitCameraControls(canvas);

const avgElem = document.getElementById('fps')!;
const frameTimeElem = document.getElementById('frametime')!;
let frameCounter = 0;
let start = 0;

const renderer = new Renderer(gl);

const runWorld = () => {
    const frameStart = performance.now();
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    // update systems per frame
    world.update();

    // render the scene
    renderer.render(cubeEntity, controls);

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

document.getElementById('start-vr')!.addEventListener('click', () => {
    navigator.xr.requestSession('immersive-vr', {
        requiredFeatures: ['local-floor'],
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

            // update systems per frame
            world.update();

            for (let view of pose.views) {
                let viewport = glLayer.getViewport(view);
                gl.viewport(viewport.x, viewport.y,
                            viewport.width, viewport.height);

                // FIXME: can't actually update the world twice, otherwise things like physics simulations will run twice as fast

                const cameraMatrix = view.transform.matrix;
                const cameraMatrixWorld = mat4.invert(mat4.create(), cameraMatrix);
                const viewProjectionMatrix = mat4.multiply(mat4.create(), view.projectionMatrix, cameraMatrixWorld);
                
                // render the scene
                renderer.render(cubeEntity, {
                    viewProjectionMatrix,
                    cameraMatrix,
                    cameraMatrixWorld,
                });
            }

            // lastCameras = thisCameras;

            session.requestAnimationFrame(onXRFrame);
        }

        const baseLayer = new XRWebGLLayer(session, gl);
        session.updateRenderState({ baseLayer });

        session.requestReferenceSpace('local-floor').then((refSpace) => {
            xrRefSpace = refSpace;

            // Inform the session that we're ready to begin drawing.
            session.requestAnimationFrame(onXRFrame);
        });
    });
});