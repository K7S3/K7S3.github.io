/* Vendored from three.js r147 examples/jsm (shaders_CopyShader.js), adapted from ES modules to global scripts under NBPost. Source: https://github.com/mrdoob/three.js/tree/r147/examples/jsm */
(function(){
'use strict';
var NBPost = globalThis.NBPost = globalThis.NBPost || {};
var THREE = globalThis.THREE;

/**
 * Full-screen textured quad shader
 */

const CopyShader = {

	uniforms: {

		'tDiffuse': { value: null },
		'opacity': { value: 1.0 }

	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );
			gl_FragColor.a *= opacity;


		}`

};



NBPost.CopyShader = CopyShader;
})();
