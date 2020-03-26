/**
 * a static color shader implementation (white)
 */
precision mediump float;

/**
 * definition of the light properties related to material properties
 */
struct Light {
	vec4 ambient;
	vec4 diffuse;
	vec4 specular;
};

// two lights only are supported!
uniform Light u_light;
uniform Light u_light2;


void main() {
	gl_FragColor = vec4(u_light.diffuse.rgb+u_light2.diffuse.rgb,1); //(0,0,0,0);
}
