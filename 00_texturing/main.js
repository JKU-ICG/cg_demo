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
var rootnofloor = null;
var rotateLight;
var rotateNode;

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
globalSettings.useAnisotropicFiltering = false;
globalSettings.useMipmapping = false;

//load the required resources using a utility function
loadResources({
  vs: 'shader/texture.vs.glsl',
  fs: 'shader/texture.fs.glsl',
  texture_diffuse: '../textures/wood.png',
  texture_diffuse2: '../textures/checkerboard.jpg',
  texture_diffuse3: '../textures/brick.jpg',
  model: '../models/C-3PO.obj',
  model2: '../models/teapot.obj'
}).then(function (resources /*an object containing our keys with the loaded resources*/) {
  init(resources);

  render(0);
});

function init(resources) {
  //create a GL context
  gl = createContext();

  gl.enable(gl.DEPTH_TEST);

  //create scenegraph
  root = createSceneGraph(gl, resources);

  initInteraction(gl.canvas);
  // init and show gui:
  initGUI();
}

function createSceneGraph(gl, resources) {

  textures = {checkerboard: resources.texture_diffuse2, wood: resources.texture_diffuse, brick: resources.texture_diffuse3};
  models = {  none: [],
              c3po: [new RenderSGNode(resources.model)],
              teapot: [new TransformationSGNode(glm.transform({scale:[.1,.1,.1], translate:[0,.9,0]}), [new RenderSGNode(resources.model2)])] };
  //create scenegraph
  const root = new ShaderSGNode(createProgram(gl, resources.vs, resources.fs));

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
    let translateLight = new TransformationSGNode(glm.translate(0,2,2)); //translating the light is the same as setting the light position

    rotateLight.append(translateLight);
    translateLight.append(light);
    translateLight.append(createLightSphere()); //add sphere for debugging: since we use 0,0,0 as our light position the sphere is at the same position as the light source
    root.append(rotateLight);
  }

  {
    //initialize C3PO
    c3po = new MaterialSGNode( //use now framework implementation of material node
      models[Object.keys(models)[0]][0]
    );
    //gold
    c3po.ambient = [0.24725, 0.1995, 0.0745, 1];
    c3po.diffuse = [0.75164, 0.60648, 0.22648, 1];
    c3po.specular = [0.628281, 0.555802, 0.366065, 1];
    c3po.shininess = 4.0;

    rotateNode = new TransformationSGNode(mat4.create(), [
      new TransformationSGNode(glm.transform({ translate: [0,0, 0], rotateX : 0, scale: 0.5 }),  [
        c3po
      ])
    ]);
    root.append(rotateNode);
  }

  {
    //initialize floor
    textureNode = new TextureSGNode(Object.values(textures)[0], 0, 'u_diffuseTex',
                    new RenderSGNode(makeFloor()));
    let floor = new MaterialSGNode( textureNode  );

    //dark
    floor.ambient = [0, 0, 0, 1];
    floor.diffuse = [0.1, 0.5, 0.1, 1];
    floor.specular = [0.5, 0.5, 0.5, 1];
    floor.shininess = 50.0;

    root.append(new TransformationSGNode(glm.transform({ translate: [0,0,0], rotateX: -90, scale: 1}), [
      floor
    ]));
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
  gl.clearColor(0.9, 0.9, 0.9, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  //setup context and camera matrices
  const context = createSGContext(gl);
  context.projectionMatrix = mat4.perspective(mat4.create(), convertDegreeToRadians(30), gl.drawingBufferWidth / gl.drawingBufferHeight, 0.01, 100);
  //very primitive camera implementation
  let lookAtMatrix = mat4.lookAt(mat4.create(), [3,0.5,-8], [0,0,0], [0,1,0]);
  let mouseRotateMatrix = mat4.multiply(mat4.create(),
                          glm.rotateX(camera.rotation.y),
                          glm.rotateY(camera.rotation.x));
  context.viewMatrix = mat4.multiply(mat4.create(), lookAtMatrix, mouseRotateMatrix);

  //update animations
  context.timeInMilliseconds = timeInMilliseconds;

  rotateNode.matrix = glm.rotateY(timeInMilliseconds*-0.01);
  rotateLight.matrix = glm.rotateY(timeInMilliseconds*0.05);

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
gl.activeTexture(textureNode.textureunit);
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
  var ext = gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
  gl.activeTexture(textureNode.textureunit);
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


function initGUI(){

  var gui = new dat.GUI();

  gui.add( globalSettings, 'useMipmapping' ).onChange(function(value){
    toggleMipmapping(value);
  }).listen();
  gui.add( globalSettings, 'useAnisotropicFiltering' ).onChange(function(value){
    toggleAnisotropicFiltering(value);
  }).listen();


  let tmpTexture = function(){}; tmpTexture.texture = Object.keys(textures)[0];
  gui.add( tmpTexture, 'texture', Object.keys(textures) ).onChange(function(value){
    textureNode.image = textures[value];
    textureNode.init(gl);
    toggleMipmapping( globalSettings.useMipmapping );
    toggleAnisotropicFiltering( globalSettings.useAnisotropicFiltering );
    //c3po.children = textures[value];
  });

  let tmpModel = function(){}; tmpModel.model = Object.keys(models)[0];
  gui.add( tmpModel, 'model', Object.keys(models) ).onChange(function(value){
    c3po.children = models[value];
  });

  gui.closed = true; // close gui to avoid using up too much screen

}
