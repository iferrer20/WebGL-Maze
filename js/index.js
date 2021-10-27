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
      console.log(e.code)
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
  updatedProj: true,
  updatedView: false,

  init() {
    Window.addResizeCallback(this.updateProjection.bind(this));
    this.updateProjection();
  },
  update() {
    mat4.translate(this.view, this.view, vec3.fromValues(0, 0, 0.01))
    this.updatedView = true;
  },
  updateProjection() {
    mat4.identity(this.proj);
    mat4.perspective(this.proj, toRadian(45), canvas.width / canvas.height, 0.1, 100.0);

    //Render.addUpdate(this.update.bind(this));
    this.updatedProj = true;
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

      if (Camera.updatedProj) {
        gl.uniformMatrix4fv(object.uniforms.proj, gl.FALSE, Camera.proj);
        Camera.updatedProj = false;
      }

      if (Camera.updatedView) {
        gl.uniformMatrix4fv(object.uniforms.view, gl.FALSE, Camera.view);
        Camera.updatedView = false;
      }

       

      gl.useProgram(object.shaderProgram);
      gl.drawElementsInstancedANGLE(
        gl.TRIANGLES,
        object.instances.length,  // num instances
        gl.UNSIGNED_SHORT,
        0,
        0
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
      pos: vec3.fromValues(0, 0, -10),
      rot: quat.fromValues(0, 0, 0, 0),
      update() {
        mat4.rotateY(this.model, this.model, 0.1);
      }
    },
    {
      pos: vec3.fromValues(1, 0, -5),
      rot: quat.fromValues(0, 0, 0, 0),
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

  vertices: [
    // Back face
    -0.5, -0.5, 0.5,
    0.5, -0.5, 0.5,
    0.5, 0.5, 0.5,
    -0.5, 0.5, 0.5
  ],
  indices: [
    0, 1, 2
  ],

  init() {

  },
  update() {

  }
}

const Objects = {
  objects: [
    Triangle
  ],

  init() {
    for (let object of this.objects) {

      { // Prepair Buffers

        object.gpubuffers = {
          vao: gl.createVertexArrayOES(),
          vbo: gl.createBuffer(),
          ebo: gl.createBuffer(),
          model: gl.createBuffer()
        };

        var { vao, vbo, ebo, model } = object.gpubuffers;

        gl.bindVertexArrayOES(vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, vbo); // Bind vbo buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(object.vertices), gl.STATIC_DRAW); // Set data

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo); // Bind ebo buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(object.indices), gl.STATIC_DRAW); // Set data indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // Unbind buffer

        object.buffers = {
          model: new ArrayBuffer(object.instances.length * 64)
        };

        object.instances.forEach((instance, c) => {
          instance.model = new Float32Array(object.buffers.model, c*64, 16);
          
          mat4.fromRotationTranslation(instance.model, instance.rot,  instance.pos);
          instance.sendBuffer = function(buffName) {
            gl.bindBuffer(gl.ARRAY_BUFFER, object.gpubuffers[buffName]);
            gl.bufferSubData(gl.ARRAY_BUFFER, 0, object.buffers[buffName]);
          } 

          if (instance.update) {
            Render.addUpdate(instance.update.bind(instance));
          }
        });
        gl.bindBuffer(gl.ARRAY_BUFFER, model);
        gl.bufferData(gl.ARRAY_BUFFER, object.buffers.model, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind buffer
      }

      Render.addUpdate(() => { // Update model each frame
        gl.bindBuffer(gl.ARRAY_BUFFER, object.gpubuffers['model']);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, object.buffers['model']);
      });

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

      {
        object.locations = {
          vbo: gl.getAttribLocation(shaderProgram, 'vPos'),
          model: gl.getAttribLocation(shaderProgram, 'model')
        }
        var vbo_loc = object.locations.vbo;
        var model_loc = object.locations.model;

        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

        gl.vertexAttribPointer(vbo_loc, 3, gl.FLOAT, false, 0, 0); // Define data location 
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // Unbind ebo
        
        gl.bindBuffer(gl.ARRAY_BUFFER, model);
        gl.vertexAttribPointer(model_loc    , 4, gl.FLOAT, false, 16 * 4, 0);
        gl.vertexAttribPointer(model_loc + 1, 4, gl.FLOAT, false, 16 * 4, 4 * 4);
        gl.vertexAttribPointer(model_loc + 2, 4, gl.FLOAT, false, 16 * 4, 4 * 8);
        gl.vertexAttribPointer(model_loc + 3, 4, gl.FLOAT, false, 16 * 4, 4 * 12);
        gl.vertexAttribDivisorANGLE(model_loc, 1);
        gl.vertexAttribDivisorANGLE(model_loc + 1, 1);
        gl.vertexAttribDivisorANGLE(model_loc + 2, 1);
        gl.vertexAttribDivisorANGLE(model_loc + 3, 1);

        gl.enableVertexAttribArray(vbo_loc); 
        gl.enableVertexAttribArray(model_loc);
        gl.enableVertexAttribArray(model_loc + 1);
        gl.enableVertexAttribArray(model_loc + 2);
        gl.enableVertexAttribArray(model_loc + 3);
      }

      {
        object.uniforms = {
          time: gl.getUniformLocation(shaderProgram, 'iTime'),
          proj: gl.getUniformLocation(shaderProgram, 'proj'),
          view: gl.getUniformLocation(shaderProgram, 'view')
        };

        var proj = mat4.create();
        mat4.perspective(proj, toRadian(45), canvas.clientWidth / canvas.clientHeight, 0.025, 1000.0);
        gl.uniformMatrix4fv(object.uniforms.proj, gl.FALSE, proj);

        mat4.translate(Camera.view, Camera.view, vec3.fromValues(0, 0, 0));
        gl.uniformMatrix4fv(object.uniforms.view, gl.FALSE, Camera.view);


        object.shaderProgram = shaderProgram;
        object.vao = vao;
        object.vbo = vbo;
        object.model = model;
      }

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

