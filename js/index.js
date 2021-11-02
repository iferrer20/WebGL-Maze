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
gl.drawArraysInstancedANGLE = instance_ext.drawArraysInstancedANGLE.bind(instance_ext); 

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
    Shaders.updateUniform('proj', u => gl.uniformMatrix4fv(u, gl.FALSE, this.proj));
    Shaders.updateUniform('view', u => gl.uniformMatrix4fv(u, gl.FALSE, this.view));
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

// LIGHT
const Light = {
  pos: [0, 0, 20],
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

      gl.useProgram(object.shader.program);

      object.render();
    
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

// MAP
const Map = {
  maps: [
    [  
      [0, 1, -1, 0, 0, 0],
      [0, 0,  1, 0, 0, 0]
    ],
  ],
}

// WORLD
const World = {
  init() {
    Render.addUpdate(this.update.bind(this));
    Objects.init();
    Light.init();
    Camera.init();
    
    
  },
  update() {
    Shaders.updateUniform('iTime', u => gl.uniform1f(u, getTime()));
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

        attribute vec3 aPos;
        attribute mat4 model; 
        attribute vec3 aNormal;

        varying vec3 Normal;
        varying vec4 FragPos;  

        uniform mat4 view;
        uniform mat4 proj;

        void main(void) {
          gl_Position = proj * view * model * vec4(aPos, 1.0);
          FragPos = model * vec4(aPos, 1.0);
          Normal = abs(mat3(model) * aNormal);
        }
      `,
      fCode: `#version 100
        #ifdef GL_ES
        precision mediump float;
        #endif

        varying vec3 Normal;
        varying vec4 FragPos;

        uniform vec3 lightPos;  
        //uniform float iTime;

        void main(void) {
          vec3 ambient = vec3(0.3);
          vec3 norm = normalize(Normal);
          vec3 lightDir = normalize(lightPos - FragPos.xyz);
          vec3 result = vec3(max(dot(norm, lightDir), 0.4));
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

        uniform mat4 view;
        uniform mat4 proj;

        void main(void) {
          gl_Position = proj * view * model * vec4(aPos, 1.0);
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
    Render.addUpdate(this.update.bind(this));
  }
}

// CUBE
const Cube = {
  drawType: gl.TRIANGLES,
  shader: Shaders.shaders.myshader,
  instances: [
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
      update() {
        mat4.rotate(this.model, this.model, 0.05 * deltaTime, vec3.fromValues(5, 1, 1));
      }
    }
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
      instanced: true,
      dynamic: true
    },
    aNormal: {
      data: new Float32Array([
        1, 1, 1,
        1, 1, 1,
        1, 1, 1,
        1, 1, 1,
        1, 1, 1,
        1, 1, 1,
      ])
    }
    /*aNormal: {
      data: vec3.fromValues(1,2,4),
      repeat: true
    }*/
  },

  init() {

  }
}


// TRIANGLE
const Triangle = {
  drawType: gl.TRIANGLES,
  shader: Shaders.shaders.red,
  instances: [
    {
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
       instanced: true,
       dynamic: true
    }
  },
  indices: new Uint16Array([0, 1, 2])
  
}

// OBJECTS
const Objects = {
  objects: [
    Cube
    //Triangle
  ],

  init() {
    for (let object of this.objects) {

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
              object.instances.length * 3,
              object.instances.length
            );
          }
        }

        
        for (const attr of Object.keys(object.attrs)) {
          let { data, instanced, dynamic } = object.attrs[attr];
          let gpubuff = gl.createBuffer();
          const { loc, type } = object.shader.attrs[attr];

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

          /*if (instance.initPos) {
            mat4.translate(instance.model, instance.model, instance.initPos);
          }*/
        });
      }
    }
    
  }
}

if (gl) {
  Window.init();
  Shaders.init();
  World.init();
  Input.init();
  Render.init();
} else {
  alert('webgl not suported');
}

