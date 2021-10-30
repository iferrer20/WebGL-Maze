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
  },

  updateUniforms(object) {
    gl.uniformMatrix4fv(object.uniforms.proj, gl.FALSE, this.proj);
    gl.uniformMatrix4fv(object.uniforms.view, gl.FALSE, this.view);
  },
  update() {
    mat4.translate(this.view, this.view, vec3.fromValues(0, 0, 0.01))
  },
  updateProjection() {
    mat4.identity(this.proj);
    mat4.identity(this.view);
    mat4.perspective(this.proj, toRadian(45), canvas.clientWidth / canvas.clientHeight, 0.025, 1000.0);
    mat4.translate(this.view, this.view, vec3.fromValues(0, 0, -8));
    //Render.addUpdate(this.update.bind(this));
  }
}

function getTime() {
  return (Date.now()/1000)-timeStart;
}

// RENDER
const Render = {
  renderUpdateQueue: [],

  onResizeWindow() {
    gl.viewport(0, 0, canvas.width, canvas.height);
  },

  update() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); 

    for (let f of this.renderUpdateQueue) {
      f();
    }

    for (let object of Objects.objects) {
      gl.uniform1f(object.uniforms.time, getTime());
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
    // gl.enable(gl.DEPTH_TEST);
    // gl.depthFunc(gl.LEQUAL);


    this.update();
  }
}

const Triangle = {
  drawType: gl.TRIANGLES,
  vShaderCode: `#version 100
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
  fShaderCode: `#version 100
  #ifdef GL_ES
  precision mediump float;
  #endif

  uniform float iTime;
  void main(void) {
    gl_FragColor = vec4(cos(iTime)/2.0+0.5, 0.0, 1.0, 1.0);
  }
  `,
  instances: [
    {
      init() {
        mat4.translate(this.model, this.model, vec3.fromValues(-3,0,0))
      },
      update() {
        //mat4.rotateY(this.model, this.model, 0.1);
      }
    },
    {
      update() {
        //mat4.rotate(this.model, this.model, 0.2, vec3.fromValues(1, 1, 1))

        let d = vec3.create();
        if (Input.keys['KeyA']) {
          d[0] += -0.1;
        } 
        if (Input.keys['KeyD']) {
          d[0] += 0.1;
        } 
        if (Input.keys['KeyW']) {
          d[1] += 0.1;
        } 
        if (Input.keys['KeyS']) {
          d[1] += -0.1;
        }

        if (Input.keys['ArrowRight']) {
          mat4.rotateY(this.model, this.model, 0.1);
        } 
        if (Input.keys['ArrowLeft']) {
          mat4.rotateY(this.model, this.model, -0.1);
        } 
        if (Input.keys['ArrowUp']) {
          mat4.rotateX(this.model, this.model, 0.1);
        } 
        if (Input.keys['ArrowDown']) {
          mat4.rotateX(this.model, this.model, -0.1);
        }

        mat4.translate(this.model, this.model, d)
        
      }
    }
  ],

  attrs: { // Object global attributes
    vPos: { 
      data: new Float32Array([
        0.5,  0.5, 0.0,  // top right
        0.5, -0.5, 0.0,  // bottom right
       -0.5, -0.5, 0.0,  // bottom left
       -0.5,  0.5, 0.0   // top left 
      ]),
    },
    model: {
      data: mat4.create(),
      instanced: true,
      dynamic: true
    }
  },
  indices: new Uint16Array([
    0, 1, 3,
    1, 2, 3
  ]),

  init() {

  }
}

const Objects = {
  objects: [
    Triangle
  ],

  init() {
    for (let object of this.objects) {

      { // Prepair shaders

        var shaderProgram = gl.createProgram();

        var vShader = gl.createShader(gl.VERTEX_SHADER);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER);

        gl.shaderSource(vShader, object.vShaderCode);
        gl.shaderSource(fShader, object.fShaderCode);

        gl.compileShader(vShader);
        gl.compileShader(fShader);

        gl.attachShader(shaderProgram, vShader);
        gl.attachShader(shaderProgram, fShader);

        gl.linkProgram(shaderProgram);

        gl.useProgram(shaderProgram);
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

        for (let attr of Object.keys(object.attrs)) {
          
          let { data, instanced, dynamic } = object.attrs[attr];
          let gpubuff = gl.createBuffer();
          let loc = gl.getAttribLocation(shaderProgram, attr);

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

          const { type } = gl.getActiveAttrib(shaderProgram, loc);

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

        { // Uniforms
          object.uniforms = {};
          let uniforms = gl.getProgramParameter(shaderProgram, gl.ACTIVE_UNIFORMS);
          for (let i=0; i<uniforms; i++) {
            let { name } = gl.getActiveUniform(shaderProgram, i);
            object.uniforms[name] = gl.getUniformLocation(shaderProgram, name);
          }

          Render.addUpdate(Camera.updateUniforms.bind(Camera, object));
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
      object.shaderProgram = shaderProgram;
      object.init();
    }
    
  }
}

if (!gl) {
  alert('webgl not suported');
} else {
  Window.init();
  Objects.init();
  Camera.init();
  Input.init();
  Render.init();
}

