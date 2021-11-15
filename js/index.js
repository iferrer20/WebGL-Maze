'use strict';
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

// GL VAO support
const oes_vao_ext = gl.getExtension('OES_vertex_array_object');
gl.bindVertexArrayOES = oes_vao_ext.bindVertexArrayOES.bind(oes_vao_ext);
gl.createVertexArrayOES = oes_vao_ext.createVertexArrayOES.bind(oes_vao_ext);
gl.deleteVertexArrayOES = oes_vao_ext.deleteVertexArrayOES.bind(oes_vao_ext);

// GL Instance support
const instance_ext = gl.getExtension('ANGLE_instanced_arrays');
gl.vertexAttribDivisorANGLE = instance_ext.vertexAttribDivisorANGLE.bind(instance_ext);
gl.drawElementsInstancedANGLE = instance_ext.drawElementsInstancedANGLE.bind(instance_ext);
gl.drawArraysInstancedANGLE = instance_ext.drawArraysInstancedANGLE.bind(instance_ext); 

// Current time start
const timeStart = Date.now()/1000;
var timeLastFrame = Date.now();
var deltaTime = Date.now();
var nextSecond = 0;

function getTime() {
  return (Date.now()/1000)-timeStart;
}

// Math utilities 
const { vec3, vec2, mat3, mat4, quat } = glMatrix;
const { toRadian } = glMatrix.glMatrix; 

// GAME
const Game = {
  level: 1,
  deaths: 0,
  infoDom: document.getElementById('game-info'),
  updateGameInfo() {
    this.infoDom.innerText = `
    Level: ${this.level}
    Attempts: ${this.deaths}
    `;
  }
}
Game.updateGameInfo();

// WINDOW
const Window = {
  onResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  },

  addResizeCallback(f) {
    window.addEventListener('resize', f);
  },

  init() {
    this.onResize();
    this.addResizeCallback(Window.onResize);
  }
}

const Input = {
  keys: {},
  init() {
    document.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
    });

    document.addEventListener('keyup', (e) => {
      delete this.keys[e.code];  
    });
  }
}

// CAMERA
const Camera = {
  proj: mat4.create(),
  view: mat4.create(),
  force: vec3.create(),
  linearDrag: 0.9,
  moveSpeed: 0.005,
  rx: toRadian(90),
  ry: toRadian(90),
  rdistance: 20,

  init() {
    Window.addResizeCallback(this.updateProjection.bind(this));

    this.updateProjection();
    Render.addUpdate(this.update, this);
    this.updateInitValues();

  },

  updateUniforms() {
    Shaders.updateUniform('proj', u => gl.uniformMatrix4fv(u, gl.FALSE, this.proj));
    Shaders.updateUniform('view', u => gl.uniformMatrix4fv(u, gl.FALSE, this.view));
  },
  updateInitValues() {
    this.pointToView = vec3.fromValues(GameMap.maps[Game.level-1][0].length/2-0.5, 0, GameMap.maps[Game.level-1].length/2); // Look to map center
    this.rdistance = GameMap.maps[Game.level-1][0].length + 5; // Set distance depending of map the size
    this.rx = toRadian(90);
    this.ry = toRadian(90);
    vec3.set(this.force, 0, 0, 0);
  },
  update() {

    if (Input.keys['ArrowLeft']) {
      this.force[0] -= this.moveSpeed * deltaTime;
    } 
    if (Input.keys['ArrowRight']) {
      this.force[0] += this.moveSpeed * deltaTime;
    }
    if (Input.keys['ArrowUp']) {
      this.force[1] -= this.moveSpeed * deltaTime;
    }
    if (Input.keys['ArrowDown']) {
      this.force[1] += this.moveSpeed * deltaTime;
    }
    if (Input.keys['KeyX']) {
      this.rdistance += 0.25 * deltaTime;
    }
    if (Input.keys['KeyZ']) {
      this.rdistance -= 0.25 * deltaTime;
    }

    let deg = (this.ry+this.force[1])*180/Math.PI
    if (deg >= 45 && deg <= 135) {
      this.ry += this.force[1];
    }

    deg = (this.rx+this.force[0])*180/Math.PI;
    if (deg >= 45 && deg <= 135) {
      this.rx += this.force[0];
    }

    this.camX = Math.cos(this.rx) * this.rdistance;
    this.camY = Math.sin(this.rx) * Math.sin(this.ry) * this.rdistance;
    this.camZ = Math.sin(this.rx) * this.rdistance * Math.cos(this.ry);

    let x = vec3.create();
    vec3.add(x, vec3.fromValues(this.camX, this.camY, this.camZ), this.pointToView);

    mat4.lookAt(this.view, x, this.pointToView, vec3.fromValues(0,0,-1));
    this.updateUniforms();

    vec3.mul(this.force, this.force, vec3.fromValues(this.linearDrag, this.linearDrag, this.linearDrag)); 

  },
  updateProjection() {
    mat4.identity(this.proj);
    mat4.perspective(this.proj, toRadian(45), canvas.clientWidth / canvas.clientHeight, 0.025, 1000.0);
    this.updateUniforms();
  }
}

// LIGHT
const Light = {
  pos: [15, -100, 15],
  init() {
    this.updateUniformPos();
  },

  updateUniformPos() {
    Shaders.updateUniform('lightPos', u => { 
      gl.uniform3fv(u, this.pos);
    });
  },
  update() {

  }
}

// RENDER
const Render = {
  renderUpdateQueue: [],
  renderObjectQueue: [],
  fps: 0,
  infoDom: document.getElementById('render-info'),

  onResizeWindow() {
    gl.viewport(0, 0, canvas.width, canvas.height);
  },
  updateRenderInfo() {
    this.infoDom.innerText = `FPS: ${this.fps}`;
  },

  update() {
    // Delta time
    deltaTime = Date.now()-timeLastFrame;
    deltaTime /= 10;
    timeLastFrame = Date.now();

    gl.clearColor(0.1, 0.0, 0.3, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); 

    for (let f of this.renderUpdateQueue) {
      f.f.apply(f.bind);
    }

    for (let object of this.renderObjectQueue) {
      gl.bindVertexArrayOES(object.vao);

      gl.useProgram(object.shader.program);

      object.render();
    }
    if (getTime() > nextSecond) {
      nextSecond = getTime() + 1;
      this.updateRenderInfo();
      
      this.fps = 0;
    } else {
      this.fps++;
    }

    requestAnimationFrame(this.update.bind(this));
  },

  addUpdate(f, bind) {
    this.renderUpdateQueue.push({f, bind});
  },
  addObject(o) {
    this.renderObjectQueue.push(o);
  },
  popObject(o) {
    let i = this.renderObjectQueue.findIndex(i => i == o);
    if (i != -1) {
      this.renderObjectQueue.splice(i, 1);
    }
    
  },
  popUpdate(f) {
    let i = this.renderUpdateQueue.findIndex(i => i.f == f);
    if (i != -1) {
      this.renderUpdateQueue.splice(i, 1);
    }
  },

  init() {

    Window.addResizeCallback(this.onResizeWindow);
    this.onResizeWindow();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);


    this.update();
  }
}

// SHADERS
const Shaders = {
  shaders: {
    myshader: {
      vCode: `#version 100
        #ifdef GL_ES
        precision mediump float;
        #endif

        attribute vec3 aPos;
        attribute vec3 aColor;
        attribute mat4 model; 
        attribute vec3 aNormal;
        attribute float aLuminance;

        varying vec3 Normal;
        varying vec4 FragPos;  
        varying vec3 color;
        varying float luminance;

        uniform mat4 view;
        uniform mat4 proj;

        void main(void) {
          gl_Position = proj * view * model * vec4(aPos, 1.0);
          FragPos = model * vec4(aPos, 1.0);
          Normal = mat3(model) * aNormal;
          color = aColor;
          luminance = aLuminance;
        }
      `,
      fCode: `#version 100
        #ifdef GL_ES
        precision mediump float;
        #endif

        varying vec3 Normal;
        varying vec3 color;
        varying vec4 FragPos;
        varying float luminance;

        uniform vec3 lightPos;
        //uniform float iTime;

        void main(void) {
          vec3 ambient = vec3(0.3) * color * luminance;
          vec3 norm = normalize(Normal);
          vec3 lightDir = normalize(lightPos - FragPos.xyz);
          vec3 result = vec3(max(pow(dot(norm, lightDir),3.0), 0.0));
          gl_FragColor = vec4(result + ambient, 1.0);
        }
      `,
    },
    red: {
      vCode: `#version 100
        #ifdef GL_ES
        precision mediump float;
        #endif

        attribute vec3 aPos;
        attribute mat4 model; 

        uniform mat4 view; // No rotate view
        uniform mat4 proj;

        void main(void) {
          vec4 a = proj * view * model * vec4(aPos, 1.0);
          gl_Position = a;
        }
      `,
      fCode: `#version 100
        #ifdef GL_ES
        precision mediump float;
        #endif

        void main(void) {
          gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
      `,
    }
  },
  updateUniform(uname, f) {
    Object.values(this.shaders).forEach(shader => {
      const u = shader.uniforms[uname];
      gl.useProgram(shader.program);
      if (u) {
        f(u);
      }
    });
  },
  update() {

  },
  init() {
    for (const [name, shader] of Object.entries(this.shaders)) {
      var shaderProgram = gl.createProgram();

      var vShader = gl.createShader(gl.VERTEX_SHADER);
      var fShader = gl.createShader(gl.FRAGMENT_SHADER);

      gl.shaderSource(vShader, shader.vCode);
      gl.shaderSource(fShader, shader.fCode);

      gl.compileShader(vShader);
      if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(vShader));
        return null;
      }
      gl.compileShader(fShader);
      if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
        console.log(gl.getShaderInfoLog(fShader));
        return null;
      }

      gl.attachShader(shaderProgram, vShader);
      gl.attachShader(shaderProgram, fShader);

      gl.linkProgram(shaderProgram);

      shader.program = shaderProgram;

      shader.uniforms = {};
      let n_uniforms = gl.getProgramParameter(shaderProgram, gl.ACTIVE_UNIFORMS);
      for (let i=0; i<n_uniforms; i++) {
        let { name } = gl.getActiveUniform(shaderProgram, i);
        shader.uniforms[name] = gl.getUniformLocation(shaderProgram, name);
      }

      shader.attrs = {};
      let n_attributes = gl.getProgramParameter(shaderProgram, gl.ACTIVE_ATTRIBUTES);
      for (let i=0; i<n_attributes; i++) {
        const { type, name } = gl.getActiveAttrib(shaderProgram, i);
        const loc = gl.getAttribLocation(shaderProgram, name);

        shader.attrs[name] = {
          id: i,
          type,
          loc
        }
      }
    }
    Render.addUpdate(this.update, this);
  }
}

function matFromPosRot(pos, rot) {
  const m = mat4.create();
  const r = quat.create();

  quat.fromEuler(r, rot[0], rot[1], rot[2]);
  mat4.fromRotationTranslation(m, r, pos);

  return m;
  
}

// Physics
const PlayerPhysics = (props) => ({
  init() {
    this.velocity = vec3.create();
    this.gravity = props.gravity;
  },
  checkColl() {

  },
  update() {
    let gravity_delta = vec3.create();
    vec3.mul(gravity_delta, this.gravity, vec3.fromValues(deltaTime, deltaTime, deltaTime));
    vec3.add(this.velocity, this.velocity, gravity_delta);
    let pos = vec3.create();
    mat4.getTranslation(pos, this.model);

    //Collisions
    let nextPosX = pos[0] + this.velocity[0];
    let nextPosY = pos[2] + this.velocity[1];
    let nextPosZ = pos[2] + this.velocity[2];

    const map = GameMap.maps[Game.level-1];

    let collX;
    let collY;
    let collZ;
    let win;

    if (pos[1] > 0) {

      collX = 
         map[~~(pos[2]+0.25)][~~(nextPosX+0.25)] == 1
      || map[~~(pos[2]+0.75)][~~(nextPosX+0.25)] == 1
      || map[~~(pos[2]+0.25)][~~(nextPosX+0.75)] == 1
      || map[~~(pos[2]+0.75)][~~(nextPosX+0.75)] == 1

      collY = map[~~(pos[2]+0.25)][~~(pos[0]+0.25)] != 2
      || map[~~(pos[2]+0.75)][~~(pos[0]+0.25)] != 2
      || map[~~(pos[2]+0.25)][~~(pos[0]+0.75)] != 2
      || map[~~(pos[2]+0.75)][~~(pos[0]+0.75)] != 2;

      collZ = 
         map[~~(nextPosZ+0.25)][~~(pos[0]+0.25)] == 1 
      || map[~~(nextPosZ+0.75)][~~(pos[0]+0.25)] == 1
      || map[~~(nextPosZ+0.25)][~~(pos[0]+0.75)] == 1
      || map[~~(nextPosZ+0.75)][~~(pos[0]+0.75)] == 1;

      win = map[~~(pos[2]+0.5)][~~(pos[0] + 0.5)] == 3;
        
    } else if (pos[1] < -3) {
      this.onDie();
      vec3.set(this.velocity, 0, 0, 0);
      return;
    }

    if (collX) {
      this.velocity[0] = 0;
    }
    if (collY) {
      this.velocity[1] = 0;
    }
    if (collZ) {
      this.velocity[2] = 0;
    }

    if (win) {
      vec3.set(this.velocity, 0, 0, 0);
      this.onWin();
      return;
    }

    vec3.mul(this.velocity, this.velocity, vec3.fromValues(props.linearDrag, props.linearDrag, props.linearDrag));
    mat4.translate(this.model, this.model, this.velocity);
  }
});



// GamePlayer
const GamePlayer = {
  shader: Shaders.shaders.red,
  drawType: gl.TRIANGLES,
  attrs: {
    aPos: { 
      data: new Float32Array([
        -0.25, -0.5, -0.25,
        0.25,  -0.5, -0.25,
        0.25,  -0.5, 0.25,
        0.25,  -0.5, 0.25,
        -0.25, -0.5, 0.25,
        -0.25, -0.5, -0.25
      ]),
    },
    model: {
      data: mat4.create(),
      instanced: true,
      dynamic: true
    }
  },
  instances: [
    {
      update() {
        this.gravity[0] = -(Math.cos(Camera.rx))/100;
        this.gravity[2] = -(Math.cos(Camera.ry))/100;
      },
      onWin() {
        GameMap.delete();
        Game.level++;
        Camera.updateInitValues();
        GameMap.loadMap();
        GameMap.load();
        Game.updateGameInfo();
      },
      onDie() {
        Game.deaths++;
        Game.updateGameInfo();
        Camera.updateInitValues();
        mat4.copy(this.model, this.spawnpoint);
      }
    }
  ],
  components: [
    PlayerPhysics({ gravity: vec3.fromValues(0,-0.01,0.0), linearDrag: 0.95 })
  ]
  
}

// GAMEMAP
const GameMap = {
  drawType: gl.TRIANGLES,
  shader: Shaders.shaders.myshader,
  maps: [
    [
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 4, 1, 2, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 1],
      [1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 1, 3, 2, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    ],
    [  // LVL 2
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 4, 1, 2, 2, 1, 3, 1],
      [1, 0, 1, 1, 1, 1, 2, 2, 1, 0, 1],
      [1, 0, 1, 2, 2, 1, 2, 2, 1, 0, 1],
      [1, 0, 0, 0, 0, 1, 2, 2, 1, 0, 1],
      [1, 1, 1, 1, 0, 1, 2, 2, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 2, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 1, 2, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 0, 2, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 2, 2, 2, 2, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
    [  // LVL 3
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 1, 2, 2, 1, 3, 1],
      [1, 0, 0, 0, 1, 1, 2, 2, 1, 0, 1],
      [1, 0, 0, 4, 2, 1, 2, 2, 1, 0, 1],
      [1, 0, 0, 1, 0, 1, 2, 2, 1, 0, 1],
      [1, 1, 1, 1, 0, 1, 2, 2, 0, 0, 1],
      [1, 0, 0, 1, 0, 1, 2, 0, 0, 0, 1],
      [1, 0, 0, 1, 0, 1, 2, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 1, 1, 1, 0, 2, 1],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 2, 2, 2, 2, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    ],
  ],
  instances: [
  ],

  attrs: { // Object global attributes
    aPos: { 
      data: new Float32Array([
        -0.5, -0.5, 0,
        0.5, -0.5, 0,  
        0.5,  0.5, 0, 
        0.5,  0.5, 0,
        -0.5,  0.5, 0,
        -0.5, -0.5, 0,
      ]),
    },
    model: {
      data: mat4.create(),
      instanced: true
    },
    aNormal: {
      data: new Float32Array([
        1, 1, 1,
        1, 1, 1,
        1, 1, 1,
        1, 1, 1,
        1, 1, 1,
        1, 1, 1
      ])
    },
    aColor: {
      data: vec3.fromValues(0,0,1),
      instanced: true
    },
    aLuminance: {
      data: new Float32Array([1.3]),
      instanced: true
    }
  },

  loadMap() {
    const map = this.maps[Game.level-1];
    const setBlock = (pos) => {
     this.instances.push(
        {
          model: matFromPosRot(vec3.fromValues(pos[0],pos[1],pos[2]+0.5), vec3.fromValues(0,0,0))
        },
        {
          model: matFromPosRot(vec3.fromValues(pos[0],pos[1],pos[2]-0.5), vec3.fromValues(0,0,0))
        },
        {
          model: matFromPosRot(vec3.fromValues(pos[0]+0.5,pos[1],pos[2]), vec3.fromValues(0,90,0))
        },
        {
          model: matFromPosRot(vec3.fromValues(pos[0]-0.5,pos[1],pos[2]), vec3.fromValues(0,90,0))
        },
        {
          model: matFromPosRot(vec3.fromValues(pos[0],pos[1]+0.5,pos[2]), vec3.fromValues(90,0,0))
        }
      );
    }

    let y = 0;
    for (const row of map) {
      let x = 0;
      for (const el of row) {
        switch (el) {
          case 0:
            this.instances.push({
              model: matFromPosRot(vec3.fromValues(x, -0.5, y), vec3.fromValues(90,0,0))
            });
            break;
          case 1:
            setBlock(vec3.fromValues(x,0,y));
            break;
          case -1:
            break;
          case 3:
            this.instances.push({
              model: matFromPosRot(vec3.fromValues(x, -0.5, y), vec3.fromValues(90,0,0)),
              aColor: vec3.fromValues(0, 1, 0),
              aLuminance: new Float32Array([2.0])
            });
            break;
          case 4:
          
            const playerInstance = GamePlayer.instances[0];
            playerInstance.spawnpoint = matFromPosRot(vec3.fromValues(x, 0.1, y), vec3.create());

            if (!playerInstance.model) {
              playerInstance.model = mat4.create();
            }
            mat4.copy(playerInstance.model, playerInstance.spawnpoint);

            this.instances.push({
              model: matFromPosRot(vec3.fromValues(x, -0.5, y), vec3.fromValues(90,0,0)),
              aColor: vec3.fromValues(1, 1, 0),
              aLuminance: new Float32Array([2.0])
            });
            break;
        
          default:
            break;
        }

        x++;
      }
      y++;
    }
  },

  init() {
    this.loadMap();
  }
}


// TRIANGLE
const Triangle = {
  drawType: gl.TRIANGLES,
  shader: Shaders.shaders.red,
  instances: [
    {
      model: matFromPosRot(vec3.create(0,0,0), vec3.create(0,0,0))
    }
  ],
  attrs: {
    aPos: {
      data: new Float32Array([
        -0.5,0.5,0.0,
        -0.5,-0.5,0.0,
         0.5,-0.5,0.0
      ]),
      
    },
    model: {
       data: mat4.create(),
       instanced: true
    }
  },
  indices: new Uint16Array([0, 1, 2])
  
}

// OBJECTS
const Objects = {
  objects: [
    GameMap,
    GamePlayer
    //Triangle
  ],

  loadObject(object) {
    if (object.init) {
      object.init();
    }
    
    { // Buffers & locations
      object.gpubuffers = {};
      object.buffers = {};

      object.vao = gl.createVertexArrayOES();
      gl.bindVertexArrayOES(object.vao);

      if (object.indices) {
        let ebo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, object.indices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // Unbind buffer
        object.gpubuffers.ebo = ebo;

        object.render = () => {
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, object.gpubuffers.ebo);

          gl.drawElementsInstancedANGLE(
            object.drawType,
            object.indices.length,  
            gl.UNSIGNED_SHORT,
            0,
            object.instances.length
          );
        }
      } else {
        object.render = () => {
          gl.drawArraysInstancedANGLE(
            object.drawType,
            0,  
            object.attrs.aPos.data.length/3,
            object.instances.length
          );
        }
      }

      object.instances.forEach((instance, c) => {
        let updates = [];
        if (instance.init) {
          instance.init();
        }

        if (instance.update) {
          Render.addUpdate(instance.update, instance);
          updates.push(instance.update);
        }
        if (object.components) {
          for (let component of object.components) {
            if (component.init) {
              component.init.apply(instance);
            }
            if (component.update) {
              Render.addUpdate(component.update, instance);
              updates.push(component.update);
            }
          }
        }

        instance.delete = () => {
          for (let update of updates) {
            Render.popUpdate(update);
          }
          let i = object.instances.findIndex(i => i == instance);
          if (i != -1) {
            object.instances.splice(i, 1);
          }
        }
      });

      for (const attr of Object.keys(object.attrs)) {
        let { data, instanced, dynamic } = object.attrs[attr];
        let gpubuff = gl.createBuffer();
        const { loc, type } = object.shader.attrs[attr];

        let buff;
        if (instanced) {
          buff = new ArrayBuffer(data.byteLength * object.instances.length);
          object.instances.forEach((instance, c) => {
            const newbuff = new data.__proto__.constructor(buff, c*data.byteLength, data.length);
            if (instance[attr]) {
              newbuff.set(instance[attr]);
            } else {
              newbuff.set(data);
            }
            instance[attr] = newbuff;
          });
        } else {
          buff = data; 
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, gpubuff);
        gl.bufferData(gl.ARRAY_BUFFER, buff, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); // Set data
        
        switch (type) {
          case gl.FLOAT_MAT4: 
            gl.vertexAttribPointer(loc    , 4, gl.FLOAT, false, 16 * 4, 0);
            gl.vertexAttribPointer(loc + 1, 4, gl.FLOAT, false, 16 * 4, 4 * 4);
            gl.vertexAttribPointer(loc + 2, 4, gl.FLOAT, false, 16 * 4, 4 * 8);
            gl.vertexAttribPointer(loc + 3, 4, gl.FLOAT, false, 16 * 4, 4 * 12);

            if (instanced) {
              gl.vertexAttribDivisorANGLE(loc + 1, 1);
              gl.vertexAttribDivisorANGLE(loc + 2, 1);
              gl.vertexAttribDivisorANGLE(loc + 3, 1);
            }

            gl.enableVertexAttribArray(loc + 1);
            gl.enableVertexAttribArray(loc + 2);
            gl.enableVertexAttribArray(loc + 3);
            break;

          case gl.FLOAT_VEC2: 
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
            break;

          case gl.FLOAT_VEC3:
            gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
            break;
          
          case gl.FLOAT:
            gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);
            break;
        }

        if (instanced) {
          gl.vertexAttribDivisorANGLE(loc, 1);
        }

        gl.enableVertexAttribArray(loc);

        object.buffers[attr] = buff;
        object.gpubuffers[attr] = gpubuff;

        if (dynamic) {
          Render.addUpdate(() => {
            gl.bindBuffer(gl.ARRAY_BUFFER, gpubuff);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, object.buffers[attr]);
          });
        }

      }

      object.delete = () => {
        // Stop rendering
        Render.popObject(object);
        
        // Delete all buffers
        for (let i = object.instances.length-1; i>=0; i--) {
          object.instances[i].delete();
        }
        for (let [name, buffer] of Object.entries(object.gpubuffers)) {
          gl.deleteBuffer(buffer);
          delete object[name];
        }
        // Delete vao
        gl.deleteVertexArrayOES(object.vao);
      }

      Render.addObject(object);
    }
       
  },

  init() {
    for (let object of this.objects) {
      object.load = () => this.loadObject(object);
      this.loadObject(object);
    }
    
  }
}

if (gl) {
  Window.init();
  Shaders.init();
  Objects.init();
  Light.init();
  Camera.init();
  Input.init();
  Render.init();
} else {
  document.getElementById('no-webgl').classList.remove('hidden');
}


