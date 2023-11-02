function WebGLAnimation() {

	let context = null;
	let isAnimating = false;
	let animationLoop = null;
	let requestId = null;

	function onAnimationFrame( time, frame, cameras, renderer ) {

		animationLoop( time, frame, cameras, renderer );

		requestId = context.requestAnimationFrame( onAnimationFrame );

	}

	return {

		start: function () {

			if ( isAnimating === true ) {
				console.error('already animating')
				return;
			}
			if ( animationLoop === null ) {
				console.error('no animation loop')
				return;
			}

			console.log('starting')
			requestId = context.requestAnimationFrame( onAnimationFrame );

			isAnimating = true;

		},

		stop: function () {

			console.log('stopping')
			context.cancelAnimationFrame( requestId );

			isAnimating = false;

		},

		setAnimationLoop: function ( callback ) {

			animationLoop = callback;

		},

		setContext: function ( value ) {

			context = value;

		},

		getIsAnimating: function () {
			return isAnimating;
		}

	};

}

export { WebGLAnimation };