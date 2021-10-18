'use strict';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
const oes_vao_ext = gl.getExtension('OES_vertex_array_object');
gl.bindVertexArrayOES = oes_vao_ext.bindVertexArrayOES.bind(oes_vao_ext);
gl.createVertexArrayOES = oes_vao_ext.createVertexArrayOES.bind(oes_vao_ext);

const timeStart = Date.now()/1000;

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

      for (let instance of object.instances) {
        gl.drawArrays(object.drawType, 0, object.indices.length);
      }
      
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

  vShaderCode: `
  attribute vec3 vPos;
  attribute vec3 position;

  void main(void) {
    gl_Position = vec4(vPos + position, 1.0);
  }
  `,
  fShaderCode: `
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
        position: [0, 1, 0] 
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
        gl.bindVertexArrayOES(vao);
        
        var vBuffer = gl.createBuffer();

        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
          
        // Pass the vertex data to the buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(object.vertices), gl.STATIC_DRAW);

        // Unbind the buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Create an empty buffer object to store Index buffer
        var iBuffer = gl.createBuffer();

        // Bind appropriate array buffer to it
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);

        // Pass the vertex data to the buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(object.indices), gl.STATIC_DRAW);
        
        // Unbind the buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

//        var posBuffer = gl.createBuffer();

 //       gl.bindBuffer(gl.ARRAY_BUFFER, new Float32Array())

      }

      { // Prepair shaders

        // Create a vertex shader object
        var vShader = gl.createShader(gl.VERTEX_SHADER);

        // Attach vertex shader source code
        gl.shaderSource(vShader, object.vShaderCode);

        // Compile the vertex shader
        gl.compileShader(vShader);

        //fragment shader source code
        // Create fragment shader object
        var fShader = gl.createShader(gl.FRAGMENT_SHADER);

        // Attach fragment shader source code
        gl.shaderSource(fShader, object.fShaderCode);

        // Compile the fragmentt shader
        gl.compileShader(fShader);

        // Create a shader program object to store
        // the combined shader program
        var shaderProgram = gl.createProgram();

        // Attach a vertex shader
        gl.attachShader(shaderProgram, vShader);

        // Attach a fragment shader
        gl.attachShader(shaderProgram, fShader);

        // Link both the programs
        gl.linkProgram(shaderProgram);

        // Use the combined shader program object
        gl.useProgram(shaderProgram);
      }

      {
        // Bind vertex buffer object
        gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);

        // Bind index buffer object
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);

        for (let instance of object.instances) {

        }

        // Get the attribute location
        var coord = gl.getAttribLocation(shaderProgram, 'vPos');

        // Point an attribute to the currently bound VBO
        gl.vertexAttribPointer(coord, 3, gl.FLOAT, false, 0, 0); 

        // Enable the attribute
        gl.enableVertexAttribArray(coord); 

      }

      {
        object.timeUniform = gl.getUniformLocation(shaderProgram, 'iTime');
        object.shaderProgram = shaderProgram;
        object.vao = vao;
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

