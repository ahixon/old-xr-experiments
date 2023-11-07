import { ArrayCamera, EventDispatcher, PerspectiveCamera, Vector3, Vector4, WebGLRenderTarget, DepthTexture, DepthFormat, DepthStencilFormat, RGBAFormat, UnsignedByteType, UnsignedIntType, UnsignedInt248Type } from 'three';
// import { WebXRController } from './WebXRController';
import { WebGLAnimation } from './webgl/WebGLAnimation';

/**
 * Assumes 2 cameras that are parallel and share an X-axis, and that
 * the cameras' projection and world matrices have already been set.
 * And that near and far planes are identical for both cameras.
 * Visualization of this technique: https://computergraphics.stackexchange.com/a/4765
 */
function setProjectionFromUnion( camera, cameraL, cameraR ) {
    const cameraLPos = new Vector3();
    const cameraRPos = new Vector3();

    cameraLPos.setFromMatrixPosition( cameraL.matrixWorld );
    cameraRPos.setFromMatrixPosition( cameraR.matrixWorld );

    const ipd = cameraLPos.distanceTo( cameraRPos );

    const projL = cameraL.projectionMatrix.elements;
    const projR = cameraR.projectionMatrix.elements;

    // VR systems will have identical far and near planes, and
    // most likely identical top and bottom frustum extents.
    // Use the left camera for these values.
    const near = projL[ 14 ] / ( projL[ 10 ] - 1 );
    const far = projL[ 14 ] / ( projL[ 10 ] + 1 );
    const topFov = ( projL[ 9 ] + 1 ) / projL[ 5 ];
    const bottomFov = ( projL[ 9 ] - 1 ) / projL[ 5 ];

    const leftFov = ( projL[ 8 ] - 1 ) / projL[ 0 ];
    const rightFov = ( projR[ 8 ] + 1 ) / projR[ 0 ];
    const left = near * leftFov;
    const right = near * rightFov;

    // Calculate the new camera's position offset from the
    // left camera. xOffset should be roughly half `ipd`.
    const zOffset = ipd / ( - leftFov + rightFov );
    const xOffset = zOffset * - leftFov;

    // TODO: Better way to apply this offset?
    cameraL.matrixWorld.decompose( camera.position, camera.quaternion, camera.scale );
    camera.translateX( xOffset );
    camera.translateZ( zOffset );
    camera.matrixWorld.compose( camera.position, camera.quaternion, camera.scale );
    camera.matrixWorldInverse.copy( camera.matrixWorld ).invert();

    // Find the union of the frustum values of the cameras and scale
    // the values so that the near plane's position does not change in world space,
    // although must now be relative to the new union camera.
    const near2 = near + zOffset;
    const far2 = far + zOffset;
    const left2 = left - xOffset;
    const right2 = right + ( ipd - xOffset );
    const top2 = topFov * far / far2 * near2;
    const bottom2 = bottomFov * far / far2 * near2;

    camera.projectionMatrix.makePerspective( left2, right2, top2, bottom2, near2, far2 );
    camera.projectionMatrixInverse.copy( camera.projectionMatrix ).invert();

}

class WebXRPresentation extends EventDispatcher {
    manager;
    session;
    animation = new WebGLAnimation();

    refSpace;
    viewerSpace;

    renderTarget = null;

    lastPoseTransform = null;

    initialPoseTransform = null;

    framebufferScaleFactor = 1.0;

    constructor(manager, mode, options) {
        super();
        this.manager = manager;
        this.mode = mode;
        this.options = options
    }

    async setup() {
        this.session = await navigator.xr.requestSession(this.mode, this.options);

        this.session.addEventListener('end', () => {
            this.stop();
            this.dispatchEvent({type: 'sessionend', data: this})
        })

        console.log('session', this.session);
        const attributes = this.manager.gl.getContextAttributes();

        // FIXME: layer support would be nice
        // setup webgl layer
        const layerInit = {
            antialias: ( this.session.renderState.layers === undefined ) ? attributes.antialias : true,
            alpha: true,
            depth: attributes.depth,
            stencil: attributes.stencil,
            framebufferScaleFactor: this.framebufferScaleFactor
        };

        const glBaseLayer = new XRWebGLLayer( this.session, this.manager.gl, layerInit );

        this.session.updateRenderState( { baseLayer: glBaseLayer } );

        if (!this.renderTarget) {
            console.log('creating new render target')
            this.renderTarget = new WebGLRenderTarget(
                glBaseLayer.framebufferWidth,
                glBaseLayer.framebufferHeight,
                {
                    format: RGBAFormat,
                    type: UnsignedByteType,
                    colorSpace: this.manager.renderer.outputColorSpace,
                    stencilBuffer: attributes.stencil
                }
            );
        }

        // animation loop is now ready to be kicked off
        this.animation.setAnimationLoop(this.onAnimationFrame.bind(this));
        this.animation.setContext(this.session);
        
        this.refSpaceType = this.mode.startsWith('immersive-') ? 'local-floor' : 'viewer';
        this.refSpace = await this.session.requestReferenceSpace(this.refSpaceType);
        this.viewerSpace = await this.session.requestReferenceSpace('viewer');
        this.baseSpace = this.refSpace;

        // setup input
        this.session.addEventListener("select", (e) => {
            // console.log('select', e)
            this.manager.beginPresentation('immersive-vr', {
                requiredFeatures: ["local-floor"],
            });
        });
    }

    getEnvironmentBlendMode() {
        return this.session ? this.session.environmentBlendMode : null;
    };

    onAnimationFrame(time, frame) {
        if (frame.session !== this.session) {
            console.warn('mismatch session from frame', frame.session, this.session)
        }

        if (this !== this.manager.lastPresentation && this.manager.lastPresentation) {
            // update this.baseSpace
            console.log('switching modes from', this.manager.lastPresentation.mode, 'to', this.mode)
            console.log('last base transform', this.manager.lastPresentation.lastBasePoseTransform)
            console.log('last view transform', this.manager.lastPresentation.lastViewPoseTransform)
            // console.log('last space as viewer transform', this.manager.lastPresentation.lastBaseSpaceAsViewerTransform)

            if (this.manager.lastPresentation.mode === 'inline' && this.mode === 'immersive-vr') {
                // this.baseSpace = this.refSpace.getOffsetReferenceSpace(this.manager.lastPresentation.lastImmersivePoseTransform.inverse /* inline */)
                this.baseSpace = this.refSpace;
            } else if (this.manager.lastPresentation.mode === 'immersive-vr' && this.mode === 'inline') {
                this.baseSpace = this.refSpace.getOffsetReferenceSpace(this.manager.lastPresentation.lastBasePoseTransform.inverse /* immersive */)
            } else {
                console.warn('unsupported transition')
            }
        }


        const pose = frame.getViewerPose(this.baseSpace);
        
        if (pose === null) {
            console.warn('no pose')
            return;
        }
        
        this.lastBasePoseTransform = pose.transform;
        this.lastViewPoseTransform = frame.getViewerPose(this.viewerSpace).transform;
        this.lastImmersivePoseTransform = frame.getViewerPose(this.refSpace).transform;

        const views = pose.views;

        if (frame.session.renderState.baseLayer !== null) {

            this.manager.renderer.setRenderTargetFramebuffer(this.renderTarget, this.session.renderState.baseLayer.framebuffer);
            this.manager.renderer.setRenderTarget(this.renderTarget);

        } else {
            console.warn('no base layer')
        }
    
        const cameras = [];

        for ( let i = 0; i < views.length; i ++ ) {

            const view = views[ i ];

            let viewport = null;

            if ( frame.session.renderState.baseLayer !== null ) {

                viewport = frame.session.renderState.baseLayer.getViewport( view );

            }

            // FIXME: support for layers would be nice
            
            let camera = cameras[ i ];

            if ( camera === undefined ) {

                camera = new PerspectiveCamera();
                camera.layers.enable( i );
                camera.viewport = new Vector4();
                cameras[ i ] = camera;

            }

            camera.matrix.fromArray( view.transform.matrix );
            camera.matrix.decompose( camera.position, camera.quaternion, camera.scale );
            camera.updateMatrixWorld( );
            camera.projectionMatrix.fromArray( view.projectionMatrix );
            camera.projectionMatrixInverse.copy( camera.projectionMatrix ).invert();
            camera.viewport.set( viewport.x, viewport.y, viewport.width, viewport.height );

            // camera.fov = RAD2DEG * 2 * Math.atan( 1 / camera.projectionMatrix.elements[ 5 ] );
            // camera.zoom = 1;
        }

        const mainCamera = new ArrayCamera(cameras);
        mainCamera.layers.enable( views.length );

        mainCamera.near = cameras[0].near;
        mainCamera.far = cameras[0].far;

        const _currentDepthNear = this.session.renderState.depthNear;
        const _currentDepthFar = this.session.renderState.depthFar;

        if ( _currentDepthNear !== mainCamera.near || _currentDepthFar !== mainCamera.far ) {
            console.log('updating near/far', mainCamera.near, mainCamera.far)
            this.session.updateRenderState( {
                depthNear: mainCamera.near,
                depthFar: mainCamera.far
            } );
        }

        if ( cameras.length === 2 ) {

            setProjectionFromUnion( mainCamera, cameras[0], cameras[1] );

        } else {

            // assume single camera setup (AR) or inline
            mainCamera.matrix.fromArray( cameras[0].matrix );
            mainCamera.matrix.decompose( mainCamera.position, mainCamera.quaternion, mainCamera.scale );
            mainCamera.projectionMatrix.copy( cameras[0].projectionMatrix );
            mainCamera.projectionMatrixInverse.copy( cameras[0].projectionMatrix ).invert();

        }

        mainCamera.updateMatrixWorld( );
    
        this.manager.lastPresentation = this
        
        this.manager.onAnimationFrame(time, frame, [mainCamera], this.manager.renderer)


    }
    

    start() {
        this.animation.start();
    }

    stop() {
        this.animation.stop();
    }
}


class WebXRPresentationManager extends EventDispatcher {
    gl;
    renderer;

    presentations = [];
    onAnimationFrame = null;
    intialRenderTarget = null;

    constructor(renderer, gl) {
        super();
        this.renderer = renderer;
        this.gl = gl;
        // console.log('renderer', this.renderer)
    }

    get isPresenting() {
        return this.presentations.length > 0;
    }

    get enabled() {
        return true;
    }

    dispose() {
        this.presentations.forEach(presentation => presentation.dispose())
    }

    setAnimationLoop(cb) {
        this.onAnimationFrame = cb;
    }

    getEnvironmentBlendMode() {
        if (this.presentations.length === 0) {
            return null;
        }

        return this.presentations[this.presentations.length - 1].getEnvironmentBlendMode();
    }

    getActivePresentation() {
        if (this.presentations.length === 0) {
            return null;
        }

        return this.presentations[this.presentations.length - 1];
    }

    async beginPresentation(mode, options) {
        if (!this.intialRenderTarget) {
            this.intialRenderTarget = this.renderer.getRenderTarget();
        }

        const presentation = new WebXRPresentation(this, mode, options);

        presentation.addEventListener('sessionend', this.onSessionEnd.bind(this));


        // stop existing presentations
        // this.presentations.forEach(p => p.stop())

        const shouldEmitEvent = this.presentations.length === 0;


        if (shouldEmitEvent) {
            this.dispatchEvent({type: 'sessionstart', data: presentation})
        } else {
            // this.presentations[this.presentations.length - 1].stop();
        }


        await presentation.setup();
        presentation.start();


        // add this one
        this.presentations.push(presentation);

        return presentation;
    }

    onSessionEnd(presentation) {
        console.log('presentation ended', presentation)

        this.presentations = this.presentations.filter(p => p !== presentation);
        if (this.presentations.length === 0) {
            this.dispatchEvent({type: 'sessionend', data: presentation })
        }
        
    }
}


export { WebXRPresentation, WebXRPresentationManager };
