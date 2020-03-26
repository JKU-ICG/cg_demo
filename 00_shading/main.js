/**
 */

var gl = null;
var root = null;
var fieldOfViewInRadians = convertDegreeToRadians(45);
var rotateLight, rotateLight2, rotateNode; // transformation nodes
var light, light2; // light
var c3po, floor; // material
var phongProgramm, staticProgramm; // shader programs (vs + fs)
var c3poModel, teapotModel;
var models = [];
var shaders = [];
const camera = {
  rotation: {
    x: 0,
    y: 0
  }
};

//load the shader resources using a utility function
loadResources({
  vs: 'shader/phong.vs.glsl',
  fs: 'shader/phong.fs.glsl', //phong
  vs_gouraud: 'shader/gouraud.vs.glsl',
  fs_gouraud: 'shader/gouraud.fs.glsl', //gouraud
  fs_blinn: 'shader/blinn.fs.glsl', // blinn
  fs_flat: 'shader/flat.fs.glsl', // flat 
  vs_single: 'shader/single.vs.glsl',
  fs_single: 'shader/single.fs.glsl',
  model: '../models/C-3PO.obj',
  model2: '../models/teapot.obj'
}).then(function (resources /*an object containing our keys with the loaded resources*/) {
  init(resources);

  render(0);
});

function init(resources) {
  //create a GL context
  gl = createContext();

  
  var standard_derivatives = gl.getExtension('OES_standard_derivatives');
  if( standard_derivatives === null )
  {
    console.log( 'not supported!' );
  }

  //enable depth test to let objects in front occluse objects further away
  gl.enable(gl.DEPTH_TEST);

  root = createSceneGraph(gl, resources);
  initInteraction(gl.canvas);

  initGUI();

  // disable light 2 -> not the nicest solution ...
  light2.enable = false;
  updateEnableLight(light2);

}

function createSceneGraph(gl, resources) {
  //create scenegraph
  let flatProgramm = createProgram(gl,resources.vs, resources.fs_flat);
  let phongProgramm = createProgram(gl, resources.vs, resources.fs);
  let blinnProgramm = createProgram(gl, resources.vs, resources.fs_blinn);
  let gouradProgramm = createProgram(gl, resources.vs_gouraud, resources.fs_gouraud);
  shaders = { flat: flatProgramm, Gourad: gouradProgramm, Phong: phongProgramm, Blinn: blinnProgramm };
  models = {  teapot: [new TransformationSGNode(glm.transform({scale:[.1,.1,.1], translate:[0,.9,0]}), [new RenderSGNode(resources.model2)])],
              c3po: [new RenderSGNode(resources.model)],
              sphere: [new TransformationSGNode(glm.transform({scale:[1,1,1], translate:[0,1,0]}), [new RenderSGNode(makeSphere(1,20,20)) ])]
           };
  const root = new ShaderSGNode(flatProgramm);

  function createLightSphere(light) {
    let material = new MaterialSGNode( new RenderSGNode(makeSphere(.2,10,10)) );
    if (typeof light !== 'undefined') { material.lights = [light]; }
    return  new ShaderSGNode(createProgram(gl, resources.vs_single, resources.fs_single), [ material ] );
        
  }

  {
    // create white light node
    light = new LightSGNode();
    light.ambient = [0, 0, 0, 1];
    light.diffuse = [1, 1, 1, 1];
    light.specular = [1, 1, 1, 1];
    light.position = [0, 2, 2];
    let lightDummy = (createLightSphere(light));
    light.append(lightDummy);
    rotateLight = new TransformationSGNode(mat4.create(), []);
    light.parent = rotateLight;
    light.enable = true;
    if(light.enable){
      rotateLight.append(light);
    }
    root.append(rotateLight);
  }


  {
    //create red light node at [2, 0.2, 0]
    light2 = new LightSGNode();
    light2.uniform = 'u_light2';
    light2.diffuse = [1, 0, 0, 1];
    light2.specular = [1, 0, 0, 1];
    light2.position = [2, 0.2, 0];
    light2.append(createLightSphere(light2));
    rotateLight2 = new TransformationSGNode(mat4.create(), []);
    light2.parent = rotateLight2;
    light2.enable = true;
    if(light2.enable){
      rotateLight2.append(light2);
    }
    root.append(rotateLight2);
  }

  {
    //wrap shader with material node
    c3po = new MaterialSGNode(
      Object.values(models)[0]
    );
    //gold
    c3po.ambient = [0.24725, 0.1995, 0.0745, 1];
    c3po.diffuse = [0.75164, 0.60648, 0.22648, 1];
    c3po.specular = [0.628281, 0.555802, 0.366065, 1];
    c3po.shininess = 50;
    c3po.lights = [light,light2];

    rotateNode = new TransformationSGNode(mat4.create(), [
      new TransformationSGNode(glm.transform({ translate: [0,0, 0], rotateX : 0, scale: 0.8 }),  [
        c3po
      ])
    ]);
    root.append(rotateNode);
  }

  {
    //wrap shader with material node
    floor = new MaterialSGNode([
      new RenderSGNode(makeRect())
    ]);

    //dark
    floor.ambient = [0, 0, 0, 1];
    floor.diffuse = [0.8, 0.8, 0.8, 1];
    floor.specular = [0.5, 0.5, 0.5, 1];
    floor.shininess = 0.3;
    floor.lights = [light,light2];

    root.append(new TransformationSGNode(glm.transform({ translate: [0,0,0], rotateX: -90, scale: 2}), [
      floor
    ]));
  }

  return root;
}

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
    //add delta mouse to camera.rotation if the left mouse button is pressed
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
  });
}


function render(timeInMilliseconds) {
  checkForWindowResize(gl);

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  //set background color to light gray
  gl.clearColor(0.9, 0.9, 0.9, 1.0);
  //clear the buffer
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


  const context = createSGContext(gl);
  context.projectionMatrix = mat4.perspective(mat4.create(), fieldOfViewInRadians, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.01, 100);

  //ReCap: what does this mean?
  context.viewMatrix = mat4.lookAt(mat4.create(), [0,3,-10], [0,0,0], [0,1,0]);

  //rotate whole scene according to the mouse rotation stored in
  //camera.rotation.x and camera.rotation.y
  context.sceneMatrix = mat4.multiply(mat4.create(),
                            glm.rotateY(camera.rotation.x),
                            glm.rotateX(camera.rotation.y));

  rotateNode.matrix = glm.rotateY(timeInMilliseconds*-0.01);

  // light rotation
  rotateLight.matrix = glm.rotateY(timeInMilliseconds*0.05);
  rotateLight2.matrix = glm.rotateY(-timeInMilliseconds*0.1);

  root.render(context);

  //animate
  requestAnimationFrame(render);
}

function convertDegreeToRadians(degree) {
  return degree * Math.PI / 180
}

var tmplight, tmplight2;
function initGUI(){

  var gui = new dat.GUI();
  var flight = createGuiLightFolder(gui,light,'light 1');
  var flight2 = createGuiLightFolder(gui,light2,'light 2');
  var fC3poMaterial = createGuiMaterialFolder(gui,c3po,'model Material');
  var fFloorMaterial = createGuiMaterialFolder(gui,floor,'floor Material');

  let tmpShader = function(){}; // empty object
  tmpShader.shader = Object.keys(shaders)[0];
  gui.add(tmpShader, 'shader', Object.keys(shaders)  ).onChange(function(value){
    root.program = shaders[value];
  }); // end gui.add

  let tmpModel = function(){}; tmpModel.model = Object.keys(models)[0];
  gui.add( tmpModel, 'model', Object.keys(models) ).onChange(function(value){
    c3po.children = models[value];
  });

  //gui.closed = true; // close gui to avoid using up too much screen

}

function updateEnableLight( light_ ){
  const tmplight = light_.tmp;
  if(light_.enable){
    light_.parent.append(light_);
    light_.diffuse=tmplight.diffuse.map(function(x){ return x/255; });
    light_.specular=tmplight.specular.map(function(x){ return x/255; });
    light_.ambient=tmplight.ambient.map(function(x){ return x/255; });
    //console.log('add light');
  }else{
    light_.parent.remove(light_);
    light_.diffuse=[0,0,0,0];
    light_.specular=[0,0,0,0];
    light_.ambient=[0,0,0,0];
    //console.log('remove light');
  }
}

function createGuiLightFolder(gui,light_,name){
  let tmplight = new LightSGNode(light_);
  tmplight.ambient = light_.ambient.map(function(x){ return x*255; });
  tmplight.diffuse = light_.diffuse.map(function(x){ return x*255; });
  tmplight.specular = light_.specular.map(function(x){ return x*255; });
  light_.tmp = tmplight;
  let flight = gui.addFolder(name);
  flight.add(light_, 'enable').onChange(function(value){
    light_.enable = value;
    updateEnableLight(light_);
  }).listen();
  flight.addColor(tmplight, 'diffuse').onChange(function(value){
    light.diffuse = value.map(function(x){ return x/255; });
  });
  flight.addColor(tmplight, 'specular').onChange(function(value){
    light.specular = value.map(function(x){ return x/255; });
  });
  flight.addColor(tmplight, 'ambient').onChange(function(value){
    light.ambient = value.map(function(x){ return x/255; });
  });
  tmplight.position = light.position.toString();
  flight.add(tmplight, 'position').onChange(function(value){
    light.position = JSON.parse("[" + value + "]");
  });
  return flight;
}

function createGuiMaterialFolder(gui,material,name){
  let tmpmaterial = function(){}; // empty object
  tmpmaterial.ambient = material.ambient.map(function(x){ return x*255; });
  tmpmaterial.diffuse = material.diffuse.map(function(x){ return x*255; });
  tmpmaterial.specular = material.specular.map(function(x){ return x*255; });
  tmpmaterial.emission = material.emission.map(function(x){ return x*255; });
  let folder = gui.addFolder(name);
  folder.addColor(tmpmaterial, 'diffuse').onChange(function(value){
    material.diffuse = value.map(function(x){ return x/255; });
  });
  folder.addColor(tmpmaterial, 'specular').onChange(function(value){
    material.specular = value.map(function(x){ return x/255; });
  });
  folder.addColor(tmpmaterial, 'ambient').onChange(function(value){
    material.ambient = value.map(function(x){ return x/255; });
  });
  folder.addColor(tmpmaterial, 'emission').onChange(function(value){
    material.emission = value.map(function(x){ return x/255; });
  });
  folder.add(material,'shininess', 0,100); // = 0.0;
  return folder;
}
