/**
 * a gouraud shader implementation
 */
attribute vec3 a_position;
attribute vec3 a_normal;

uniform mat4 u_modelView;
uniform mat3 u_normalMatrix;
uniform mat4 u_projection;

//light position as uniform
uniform vec3 u_lightPos;
//second light source
uniform vec3 u_light2Pos;


/**
 * definition of a material structure containing common properties
 */
struct Material {
	vec4 ambient;
	vec4 diffuse;
	vec4 specular;
	vec4 emission;
	float shininess;
};

/**
 * definition of the light properties related to material properties
 */
struct Light {
	vec4 ambient;
	vec4 diffuse;
	vec4 specular;
};

uniform Material u_material;

uniform Light u_light;
uniform Light u_light2;

varying vec4 v_color;

vec4 calculateSimplePointLight(Light light, Material material, vec3 lightVec, vec3 normalVec, vec3 eyeVec) {
	lightVec = normalize(lightVec);
	normalVec = normalize(normalVec);
	eyeVec = normalize(eyeVec);


	//compute diffuse term
	float diffuse = max(dot(normalVec,lightVec),0.0);

	//compute specular term
	vec3 reflectVec = reflect(-lightVec,normalVec);
	float spec = pow( max( dot(reflectVec, eyeVec), 0.0) , material.shininess);


	vec4 c_amb  = clamp(light.ambient * material.ambient, 0.0, 1.0);
	vec4 c_diff = clamp(diffuse * light.diffuse * material.diffuse, 0.0, 1.0);
	vec4 c_spec = clamp(spec * light.specular * material.specular, 0.0, 1.0);
	vec4 c_em   = material.emission;

	return c_amb + c_diff + c_spec + c_em;
}

void main() {
	vec4 eyePosition = u_modelView * vec4(a_position,1);

  vec3 normalVec = u_normalMatrix * a_normal;

  vec3 eyeVec = -eyePosition.xyz;
	//light position as uniform
	vec3 lightVec = u_lightPos - eyePosition.xyz;
	//second light source position
	vec3 light2Vec = u_light2Pos - eyePosition.xyz;

	v_color =
		calculateSimplePointLight(u_light, u_material, lightVec, normalVec, eyeVec)
		+ calculateSimplePointLight(u_light2, u_material, light2Vec, normalVec, eyeVec);

	gl_Position = u_projection * eyePosition;


}
