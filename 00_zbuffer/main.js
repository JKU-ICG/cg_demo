/**
 *
 */
'use strict';

var gl = null;
const camera = {
  rotation: {
    x: 0,
    y: 0
  }
};

//scene graph nodes
var root = null;
var rootUniform = null;
var rootnofloor = null;
var sphereUniformNode = null;
var rotateLight;
var rotateNode;

var sphereNodes = [];

//textures
var renderTargetColorTexture;
var renderTargetDepthTexture;
var floorTexture;
var textureNode;
var c3po; // model node
var textures; // store all textures
var models; // store all models

// global Settings
var globalSettings = function(){};
globalSettings.useAnisotropicFiltering = true;
globalSettings.useMipmapping = true;
globalSettings.showZBuffer = false;
globalSettings.numSpheres = 0;
globalSettings.transparentSpheres = false;
globalSettings.animate = true;
globalSettings.enableDepthTest = true;
globalSettings.nearPlane = 2;
globalSettings.farPlane = 20;

//load the required resources using a utility function
loadResources({
  vs: 'shader/texture.vs.glsl',
  fs: 'shader/texture.fs.glsl',
  texture_diffuse: '../textures/wood.png',
  texture_checkerboard: '../textures/checkerboard.jpg'
}).then(function (resources /*an object containing our keys with the loaded resources*/) {
  init(resources);

  render(0);
});

function init(resources) {
  //create a GL context
  gl = createContext();

  if(globalSettings.enableDepthTest)
    gl.enable(gl.DEPTH_TEST);
  else
    gl.disable(gl.DEPTH_TEST);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  //create scenegraph
  root = createSceneGraph(gl, resources);

  initInteraction(gl.canvas);
  // init and show gui:
  initGUI();
}

function createSceneGraph(gl, resources) {

  //create scenegraph
  const root = new ShaderSGNode(createProgram(gl, resources.vs, resources.fs));
  rootUniform = new SetUniformSGNode( 'u_showDepth', globalSettings.showZBuffer );
  rootUniform.uniforms['u_alpha'] = 1.0;
  root.append(rootUniform);

  //light debug helper function
  function createLightSphere() {
    let lightMat = new MaterialSGNode( [new RenderSGNode(makeSphere(.2,10,10))] );
    lightMat.emission = [1, 1, 1, 1]; // only set emission so sphere is white
    lightMat.ambient = lightMat.diffuse = lightMat.specular = [0, 0, 0, 1]; // everyting else is black (0)
    return lightMat;
  }

  {
    //initialize light
    let light = new LightSGNode(); //use now framework implementation of light node
    light.ambient = [0.2, 0.2, 0.2, 1];
    light.diffuse = [0.8, 0.8, 0.8, 1];
    light.specular = [1, 1, 1, 1];
    light.position = [0, 0, 0];

    rotateLight = new TransformationSGNode(mat4.create());
    let translateLight = new TransformationSGNode(glm.translate(0,2,-2)); //translating the light is the same as setting the light position

    rotateLight.append(translateLight);
    translateLight.append(light);
    //translateLight.append(createLightSphere()); //add sphere for debugging: since we use 0,0,0 as our light position the sphere is at the same position as the light source
    rootUniform.append(rotateLight);
  }

  {
    //initialize floor2 for z fighting??
    textureNode = new TextureSGNode(resources.texture_checkerboard, 0, 'u_diffuseTex',
                    new RenderSGNode(makeFloor()));
    let floor = new MaterialSGNode( textureNode  );
    textureNode.init(gl);
    toggleAnisotropicFiltering(true);
    toggleMipmapping(true);

    //dark
    floor.ambient = [0, 0, 0, 1];
    floor.diffuse = [0.1, 0.5, 0.1, 1];
    floor.specular = [0.5, 0.5, 0.5, 1];
    floor.shininess = 50.0;

    rootUniform.append(new TransformationSGNode(glm.transform({ translate: [0,-.0001,0], rotateX: -90, scale: 1}), [
      floor
    ]));
  }

  {
    //initialize floor
    textureNode = new TextureSGNode(resources.texture_diffuse, 0, 'u_diffuseTex',
                    new RenderSGNode(makeFloor()));
    let floor = new MaterialSGNode( textureNode  );
    textureNode.init(gl);
    toggleAnisotropicFiltering(true);
    toggleMipmapping(true);

    //dark
    floor.ambient = [0, 0, 0, 1];
    floor.diffuse = [0.1, 0.5, 0.1, 1];
    floor.specular = [0.5, 0.5, 0.5, 1];
    floor.shininess = 50.0;

    rootUniform.append(new TransformationSGNode(glm.transform({ translate: [0,0,0], rotateX: -90, scale: 1}), [
      floor
    ]));
  }

  

  {
    let sphereRadius = .4;
    let nxy_2 = 5;
    let countSpheres = 0;

    sphereUniformNode = new SetUniformSGNode( 'u_alpha', 1.0); // globalSettings.alpha );
    rootUniform.append(sphereUniformNode);
    
    for( let y = -nxy_2; y <= nxy_2; ++y )
    for( let x = -nxy_2; x <= nxy_2; ++x )
    {
      //initialize spheres/objects
      //textureNode = new TextureSGNode(Object.values(textures)[0], 0, 'u_diffuseTex',
      //new RenderSGNode(makeSphere(sphereRadius)));
      let floor = new MaterialSGNode( new RenderSGNode(makeSphere(sphereRadius))  );

      let rgb = [(nxy_2+x)/(2*nxy_2+1), (nxy_2+y)/(2*nxy_2+1), 0, 1];
      rgb[2] = Math.max( 0, 1 - rgb[1] - rgb[0] );

      //dark
      floor.ambient = [rgb[0]*.5,rgb[1]*.5,rgb[1]*.5,1];
      floor.diffuse = rgb; //[0.1, 0.5, 0.1, 1];
      floor.specular = [0.5, 0.5, 0.5, 1];
      floor.shininess = 50.0;

      sphereNodes[countSpheres] = new TransformationSGNode(glm.transform({ translate: [x,sphereRadius,y], rotateX: 0, scale: 1}), [
        floor
        ]);

      //root.append(sphereNodes[countSpheres]);

      countSpheres ++;

    }


  }


  return root;
}


function makeFloor() {
  var width = 5;
  var height = 5;
  var position = [-width, -height, 0,   width, -height, 0,   width, height, 0,   -width, height, 0];
  var normal = [0, 0, 1,   0, 0, 1,   0, 0, 1,   0, 0, 1];
  var texturecoordinates = [0, 0,   5, 0,   5, 5,   0,5];
  //var texturecoordinates = [0, 0,   5, 0,   5, 5,   0, 5];
  var index = [0, 1, 2,   2, 3, 0];
  return {
    position: position,
    normal: normal,
    texture: texturecoordinates,
    index: index
  };
}


function render(timeInMilliseconds) {
  checkForWindowResize(gl);

  //setup viewport
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //setup context and camera matrices
  const context = createSGContext(gl);
  context.projectionMatrix = mat4.perspective(mat4.create(), convertDegreeToRadians(30), gl.drawingBufferWidth / gl.drawingBufferHeight, globalSettings.nearPlane, globalSettings.farPlane);
  //very primitive camera implementation
  let lookAtMatrix = mat4.lookAt(mat4.create(), [1,2,-8], [0,0,0], [0,1,0]);
  let mouseRotateMatrix = mat4.multiply(mat4.create(),
                          glm.rotateX(camera.rotation.y),
                          glm.rotateY(camera.rotation.x));
  context.viewMatrix = mat4.multiply(mat4.create(), lookAtMatrix, mouseRotateMatrix);

  //update animations
  context.timeInMilliseconds = timeInMilliseconds;

  //rotateLight.matrix = glm.rotateY(timeInMilliseconds*0.05);

  //render scenegraph
  root.render(context);

  //animate
  requestAnimationFrame(render);
}

//camera control
function initInteraction(canvas) {
  const mouse = {
    pos: { x : 0, y : 0},
    leftButtonDown: false
  };
  function toPos(event) {
    //convert to local coordinates
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
  canvas.addEventListener('mousedown', function(event) {
    mouse.pos = toPos(event);
    mouse.leftButtonDown = event.button === 0;
  });
  canvas.addEventListener('mousemove', function(event) {
    const pos = toPos(event);
    const delta = { x : mouse.pos.x - pos.x, y: mouse.pos.y - pos.y };
    if (mouse.leftButtonDown) {
      //add the relative movement of the mouse to the rotation variables
  		camera.rotation.x += delta.x;
  		camera.rotation.y += delta.y;
    }
    mouse.pos = pos;
  });
  canvas.addEventListener('mouseup', function(event) {
    mouse.pos = toPos(event);
    mouse.leftButtonDown = false;
  });
  //register globally
  document.addEventListener('keypress', function(event) {
    //https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent
    if (event.code === 'KeyR') {
      camera.rotation.x = 0;
  		camera.rotation.y = 0;
    }
    if (event.code === 'KeyM') {
    //enable/disable mipmapping
    globalSettings.useMipmapping = !globalSettings.useMipmapping;
    toggleMipmapping( globalSettings.useMipmapping );
  }
  if (event.code === 'KeyA') {
    //enable/disable anisotropic filtering (only visible in combination with mipmapping)
    globalSettings.useAnisotropicFiltering = !globalSettings.useAnisotropicFiltering;
    toggleAnisotropicFiltering( globalSettings.useAnisotropicFiltering );
  }
});
}


function toggleMipmapping(value){
//enable/disable mipmapping
gl.activeTexture(gl.TEXTURE0 + textureNode.textureunit);
gl.bindTexture(gl.TEXTURE_2D, textureNode.textureId);
if(value)
{
  console.log('Mipmapping enabled');
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}
else
{
  console.log('Mipmapping disabled');
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
}
gl.bindTexture(gl.TEXTURE_2D, null);
}

function toggleAnisotropicFiltering(value){
  //enable/disable anisotropic filtering (only visible in combination with mipmapping)
  var ext = (
    gl.getExtension('EXT_texture_filter_anisotropic') ||
    gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
    gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
  );
  if(!ext){
    console.log('Anisotropic filtering not supported!');
    return;
  }
  gl.activeTexture(gl.TEXTURE0 + textureNode.textureunit);
  gl.bindTexture(gl.TEXTURE_2D, textureNode.textureId);
  if(value)
  {
    console.log('Anisotropic filtering enabled');
    var max_anisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
    gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, max_anisotropy);
  }
  else
  {
    console.log('Anisotropic filtering disabled');
    gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 1);
  }
  gl.bindTexture(gl.TEXTURE_2D, null);
}

function convertDegreeToRadians(degree) {
  return degree * Math.PI / 180
}

var aniInterval = setInterval(increaseNumSpheres, 100);
function increaseNumSpheres(){
  globalSettings.numSpheres ++;
  if( globalSettings.numSpheres > sphereNodes.length ){
      globalSettings.numSpheres = 0;
  }
  updateSpheres();
}

function updateSpheres(){
  for( let i = 0; i < sphereNodes.length; ++i ){  
    sphereUniformNode.remove(sphereNodes[i]);
  }
  for( let i = 0; i < globalSettings.numSpheres; ++i ){  
    sphereUniformNode.append(sphereNodes[i]);
  }
}


function initGUI(){

  var gui = new dat.GUI();

  gui.add( globalSettings, 'animate' ).onChange(function(value){
    if(value){
      aniInterval = setInterval(increaseNumSpheres, 100); // every x ms
    }else if(aniInterval){
      clearInterval(aniInterval);
    }
  }).listen();
  gui.add( globalSettings, 'numSpheres', 0, sphereNodes.length  ).onChange(function(value){
    globalSettings.numSpheres = value;
    updateSpheres();
  }).listen();

  'transparentSpheres'
  gui.add( globalSettings, 'transparentSpheres' ).onChange(function(value){
    if(value)
      sphereUniformNode.uniforms['u_alpha'] = .5;
    else
      sphereUniformNode.uniforms['u_alpha'] = 1.0;
  }).listen();

  gui.add( globalSettings, 'enableDepthTest' ).onChange(function(value){
    globalSettings.enableDepthTest = value;
    if(globalSettings.enableDepthTest)
      gl.enable(gl.DEPTH_TEST);
    else
      gl.disable(gl.DEPTH_TEST);
  }).listen();


  gui.add( globalSettings, 'showZBuffer' ).onChange(function(value){
    globalSettings.showZBuffer = value;
    rootUniform.uniforms['u_showDepth'] = globalSettings.showZBuffer;
  }).listen();

  gui.add( globalSettings, 'nearPlane', 0.0001, 10 ).listen();
  gui.add( globalSettings, 'farPlane', 20, 10000000 ).listen();


  //gui.closed = true; // close gui to avoid using up too much screen

}
