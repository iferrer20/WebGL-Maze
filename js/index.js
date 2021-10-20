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
gl.drawArraysInstancedANGLE = instance_ext.drawArraysInstancedANGLE.bind(instance_ext);

// Current time start
const timeStart = Date.now()/1000;

// Math utilities 
const { vec3 } = glMatrix;

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

// RENDER
const Render = {
  renderUpdateQueue: [],
  gl: null,

  onResizeWindow() {
    gl.viewport(0, 0, canvas.width, canvas.height);
  },

  update() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT); 
    for (let object of Objects.objects) {
      gl.uniform1f(object.timeUniform, (Date.now()/1000)-timeStart);

      gl.bindVertexArrayOES(object.vao);
      gl.useProgram(object.shaderProgram);


      gl.drawArraysInstancedANGLE(
        gl.TRIANGLES,
        0,                      // offset
        object.indices.length,   // num vertices per instance
        object.instances.length,  // num instances
      );
        //gl.drawArrays(object.drawType, 0, object.indices.length);
      
    }
    requestAnimationFrame(() => this.update());
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
  attribute vec3 position;

  void main(void) {
    gl_Position = vec4(vPos + position, 1.0);
  }
  `,
  fShaderCode: `#version 100
  #ifdef GL_ES
  precision mediump float;
  #endif

  uniform float iTime;
  void main(void) {
    gl_FragColor = vec4(cos(iTime)/2.0+0.5, 0.0, 0.0, 1.0);
  }
  `,
  instances: [
    {
      attrs: {
        position: [0, 0, 0]
      }
    },
    {
      attrs: {
        position: [1, 0, 0]
      }
    }
  ],

  vertices: [
    -0.5,0.5,0.0,
    -0.5,-0.5,0.0,
    0.5,-0.5,0.0
  ],
  indices: [0, 1, 2],

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

        var vao = gl.createVertexArrayOES();
        var vbo = gl.createBuffer();
        var ebo = gl.createBuffer();
        var pos = gl.createBuffer();

        gl.bindVertexArrayOES(vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, vbo); // Bind vbo buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(object.vertices), gl.STATIC_DRAW); // Set data

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo); // Bind ebo buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(object.indices), gl.STATIC_DRAW); // Set data indices
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // Unbind buffer

        gl.bindBuffer(gl.ARRAY_BUFFER, pos); // Bind pos buffer
        const arrPositions = [];
        for (let instance of object.instances) {
          arrPositions.push(...instance.attrs.position);
        }
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arrPositions), gl.DYNAMIC_DRAW); // Set object position
        gl.bindBuffer(gl.ARRAY_BUFFER, null); // Unbind buffer

      }

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
        var vbo_loc = gl.getAttribLocation(shaderProgram, 'vPos');
        var pos_loc = gl.getAttribLocation(shaderProgram, 'position');

        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

        gl.vertexAttribPointer(vbo_loc, 3, gl.FLOAT, false, 0, 0); // Define data location 
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // Unbind ebo
        

        gl.bindBuffer(gl.ARRAY_BUFFER, pos);
        gl.vertexAttribPointer(pos_loc, 3, gl.FLOAT, false, 0, 0);
        gl.vertexAttribDivisorANGLE(pos_loc, 1);

        gl.enableVertexAttribArray(vbo_loc); 
        gl.enableVertexAttribArray(pos_loc);

      }

      {
        object.timeUniform = gl.getUniformLocation(shaderProgram, 'iTime');
        object.shaderProgram = shaderProgram;
        object.vao = vao;
        object.vbo = vbo;
      }

      object.init();
    }
    
  }
}

if (!gl) {
  alert('webgl not suported');
} else {
  Window.init();
  Render.init();
  Objects.init();
}

