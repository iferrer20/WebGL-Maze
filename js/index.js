"use strict";

const canvas = document.getElementById('glcanvas');

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
    this.gl.viewport(0, 0, canvas.width, canvas.height);
  },

  update() {
    for (let f of this.renderUpdateQueue) {
      f();
    }

    requestAnimationFrame(() => this.update());
  },

  addUpdate(f) {
    this.renderUpdateQueue.push(f);
  },

  init() {
    // Initialize context
    try {
      this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    } catch(e) {}

    if (!this.gl) {
      alert('Gl not suported');
      return;
    }
    this.onResizeWindow();
    
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    // gl.enable(gl.DEPTH_TEST);
    // gl.depthFunc(gl.LEQUAL);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT); 

    this.update();
  }
}

const Triangle = {
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
  instances: [

  ],

  update() {
    for (let object of this.objects)
      object.update();
  },

  init() {
    for (let object of this.objects) {
      object.init();

      var vertex_buffer;
      // Prepair Buffers
      {
        vertex_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
          
        // Pass the vertex data to the buffer
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(object.vertices), gl.STATIC_DRAW);

        // Unbind the buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        // Create an empty buffer object to store Index buffer
        var Index_Buffer = gl.createBuffer();

        // Bind appropriate array buffer to it
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, Index_Buffer);

        // Pass the vertex data to the buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(object.indices), gl.STATIC_DRAW);
        
        // Unbind the buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

      }
    }
    
      
    Render.addUpdate(this.update.bind(this));

  }
}

Window.init();
Render.init();
Objects.init();