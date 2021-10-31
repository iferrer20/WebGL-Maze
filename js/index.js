'use strict';
const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

// GL VAO support
const oes_vao_ext = gl.getExtension('OES_vertex_array_object');
gl.bindVertexArrayOES = oes_vao_ext.bindVertexArrayOES.bind(oes_vao_ext);
gl.createVertexArrayOES = oes_vao_ext.createVertexArrayOES.bind(oes_vao_ext);

// GL Instance support
const instance_ext = gl.getExtension('ANGLE_instanced_arrays');
gl.vertexAttribDivisorANGLE = instance_ext.vertexAttribDivisorANGLE.bind(instance_ext);
gl.drawElementsInstancedANGLE = instance_ext.drawElementsInstancedANGLE.bind(instance_ext);

// Current time start
const timeStart = Date.now()/1000;
var timeLastFrame = Date.now();
var deltaTime = Date.now();

function getTime() {
  return (Date.now()/1000)-timeStart;
}

// Math utilities 
const { vec3, vec2, mat3, mat4, quat } = glMatrix;
const { toRadian } = glMatrix.glMatrix;

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

  init() {
    Window.addResizeCallback(this.updateProjection.bind(this));
    this.updateProjection();
    Render.addUpdate(this.update.bind(this));
  },

  updateUniforms() {
    Shaders.forEach(shader => {
      gl.useProgram(shader.program);
      gl.uniformMatrix4fv(shader.uniforms.proj, gl.FALSE, this.proj);
      gl.uniformMatrix4fv(shader.uniforms.view, gl.FALSE, this.view);
    });
  },
  update() {
    
  },
  updateProjection() {
    mat4.identity(this.proj);
    mat4.identity(this.view);
    mat4.perspective(this.proj, toRadian(45), canvas.clientWidth / canvas.clientHeight, 0.025, 1000.0);
    mat4.translate(this.view, this.view, vec3.fromValues(0, 0, -8));
    this.updateUniforms();
  }
}

// RENDER
const Render = {
  renderUpdateQueue: [],

  onResizeWindow() {
    gl.viewport(0, 0, canvas.width, canvas.height);
  },

  update() {
    // Delta time
    deltaTime = Date.now()-timeLastFrame;
    deltaTime /= 10;
    timeLastFrame = Date.now();

    gl.clearColor(0.1, 0.0, 0.3, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); 

    for (let f of this.renderUpdateQueue) {
      f();
    }

    for (let object of Objects.objects) {
      gl.bindVertexArrayOES(object.vao);

      gl.useProgram(object.shaderProgram);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, object.gpubuffers.ebo);

      gl.drawElementsInstancedANGLE(
        object.drawType,
        object.indices.length,  
        gl.UNSIGNED_SHORT,
        0,
        object.instances.length
      );
    
    }
    requestAnimationFrame(this.update.bind(this));
  },

  addUpdate(f) {
    this.renderUpdateQueue.push(f);
  },

  init() {

    Window.addResizeCallback(this.onResizeWindow);
    this.onResizeWindow();
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);


    this.update();
  }
}

// WORLD
const World = {
  init() {
    Render.addUpdate(this.update.bind(this));
  },
  update() {
    Shaders.forEach(shader => gl.uniform1f(shader.uniforms.iTime, getTime()));
  },
}

// SHADERS
const Shaders = {
  shaders: {
    myshader: {
      vCode: `#version 100
        #ifdef GL_ES
        precision mediump float;
        #endif

        attribute vec3 vPos;
        attribute mat4 model; 

        uniform mat4 view;
        uniform mat4 proj;

        void main(void) {
          gl_Position = proj * view * model * vec4(vPos, 1.0);
        }
      `,
      fCode: `#version 100
        #ifdef GL_ES
        precision mediump float;
        #endif

        uniform float iTime;
        void main(void) {
          gl_FragColor = vec4(cos(iTime), 0.0, 1.0, 1.0);
        }
      `,
    }
  },
  forEach(f) {
    Object.values(this.shaders).forEach(f);
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
      gl.compileShader(fShader);

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
    }
    Render.addUpdate(this.update.bind(this));
  }
}

// CUBE
const Cube = {
  drawType: gl.TRIANGLES,
  shaderProgram: 'myshader',
  instances: [
    {
      init() {
        mat4.translate(this.model, this.model, vec3.fromValues(-3,0,0))
      },
      update() {
        mat4.rotate(this.model, this.model, 0.01 * deltaTime, vec3.fromValues(1, 1, 1));
      }
    },
    {
      update() {
        //mat4.rotate(this.model, this.model, 0.2, vec3.fromValues(1, 1, 1))

        let d = vec3.create();
        if (Input.keys['KeyA']) {
          d[0] += -0.1 * deltaTime;
        } 
        if (Input.keys['KeyD']) {
          d[0] += 0.1 * deltaTime;
        } 
        if (Input.keys['KeyW']) {
          d[1] += 0.1 * deltaTime;
        } 
        if (Input.keys['KeyS']) {
          d[1] += -0.1 * deltaTime;
        }

        if (Input.keys['ArrowRight']) {
          mat4.rotateY(this.model, this.model, 0.1 * deltaTime);
        } 
        if (Input.keys['ArrowLeft']) {
          mat4.rotateY(this.model, this.model, -0.1 * deltaTime);
        } 
        if (Input.keys['ArrowUp']) {
          mat4.rotateX(this.model, this.model, 0.1 * deltaTime);
        } 
        if (Input.keys['ArrowDown']) {
          mat4.rotateX(this.model, this.model, -0.1 * deltaTime);
        }

        mat4.translate(this.model, this.model, d);
        
      }
    },
    {
      init() {
        mat4.translate(this.model, this.model, vec3.fromValues(3, 0, 0));
      },
      update() {
        mat4.rotateY(this.model, this.model, 0.01);
        mat4.translate(this.model, this.model, vec3.fromValues(-0.01, 0, 0));
        
      }
    },
    {
      init() {
        mat4.translate(this.model, this.model, vec3.fromValues(0, 2, 0));
      }
    }
  ],

  attrs: { // Object global attributes
    vPos: { 
      data: new Float32Array([
        -0.5, 0.5, 0.5,
        0.5,  0.5, 0.5,
        0.5, -0.5, 0.5,
        -0.5,-0.5, 0.5,
        -0.5, 0.5,-0.5,
        0.5,  0.5,-0.5,
        0.5, -0.5,-0.5,
        -0.5,-0.5,-0.5
      ]),
    },
    model: {
      data: mat4.create(),
      instanced: true,
      dynamic: true
    }
  },
  indices: new Uint16Array([
		0,3,2,  //Front
		2,1,0,
		1,5,6,	//Right
		6,2,1,
		5,4,7,	//Left
		7,6,5,
		4,7,3,	//Back
		3,0,4,
		4,5,1,	//Top
		1,0,4,
		3,2,6,	//Bottom
		6,7,3
  ]),

  init() {

  }
}

// TRIANGLE
const Triangle = {
  drawType: gl.TRIANGLES,
  shaderProgram: 'myshader',
  instances: [
    {
    }
  ],
  attrs: {
    vPos: {
      data: new Float32Array([
        -0.5,0.5,0.0,
        -0.5,-0.5,0.0,
         0.5,-0.5,0.0
      ]),
      
    },
    model: {
       data: mat4.create(),
       instanced: true,
       dynamic: true
    }
  },
  indices: new Uint16Array([0, 1, 2])
  
}

const Objects = {
  objects: [
    Cube,
    Triangle
  ],

  init() {
    for (let object of this.objects) {

      { // Load shader program
        object.shaderProgram = Shaders.shaders[object.shaderProgram].program;
      }

      { // Buffers & locations
        object.gpubuffers = {};
        object.buffers = {};
        object.locations = {};
        object.buffers = {};

        object.vao = gl.createVertexArrayOES();
        gl.bindVertexArrayOES(object.vao);

        if (object.indices) {
          let ebo = gl.createBuffer();
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
          gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, object.indices, gl.STATIC_DRAW);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // Unbind buffer
          object.gpubuffers.ebo = ebo;
        }

        for (const attr of Object.keys(object.attrs)) {
          
          let { data, instanced, dynamic } = object.attrs[attr];
          let gpubuff = gl.createBuffer();
          let loc = gl.getAttribLocation(object.shaderProgram, attr);

          let buff;
          if (instanced) {
            buff = new ArrayBuffer(data.byteLength * object.instances.length);
            object.instances.forEach((instance, c) => {
              instance[attr] = new data.__proto__.constructor(buff, c*data.byteLength, data.length);
              instance[attr].set(data);
            });
          } else {
            buff = data; 
          }

          const { type } = gl.getActiveAttrib(object.shaderProgram, loc);

          gl.bindBuffer(gl.ARRAY_BUFFER, gpubuff);
          gl.bufferData(gl.ARRAY_BUFFER, buff, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); // Set data
          
          switch (type) {
            case 35676: // MAT4
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

            case 35664: // VEC2
              gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
              break;

            case 35665: // VEC3
              gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
              break;
          }

          if (instanced) {
            gl.vertexAttribDivisorANGLE(loc, 1);
          }

          gl.enableVertexAttribArray(loc);

          object.locations[attr] = loc;
          object.buffers[attr] = buff;
          object.gpubuffers[attr] = gpubuff;

          if (dynamic) {
            Render.addUpdate(() => {
              gl.bindBuffer(gl.ARRAY_BUFFER, gpubuff);
              gl.bufferSubData(gl.ARRAY_BUFFER, 0, object.buffers[attr]);
            });
          }

        }

        object.instances.forEach((instance, c) => {
          if (instance.init) {
            instance.init();
          }

          if (instance.update) {
            Render.addUpdate(instance.update.bind(instance));
          }
        });
      }
    }
    
  }
}

if (!gl) {
  alert('webgl not suported');
} else {
  Window.init();
  Shaders.init();
  World.init();
  Objects.init();
  Camera.init();
  Input.init();
  Render.init();
}

