// ==============================================================================
// Camera Object
// Set the viewport separately

window.SAM = window.SAM || {};

(function () {
  'use strict';

  function Camera () {
    // Better managmenet of layers and sub layers.
    // Assign a range of the z buffer  for the view to use exclusively.
    // The full range is -1->1.  -1 is in front.
    this.ZRange = [-1.0, 1.0];
    this.Roll = 0;
    this.Matrix = mat4.create();
    this.Height = 16000;
    this.Width = this.Height * 1.62;
    this.FocalPoint = [128.0 * 64.0, 128.0 * 64.0];
    this.ComputeMatrix();
    // for drawing the view bounds.
    this.Points = [];
    this.Buffer = null;
    this.CreateBuffer();
    this.Mirror = false;

    // A transform from slide coordinates to section coordinates.
    // this.SectionTransform = undefined;
    // But we laready have section transform in section object.

    // Placeholders
    this.ViewportWidth = 162;
    this.ViewportHeight = 100;
  }

  // Spacing of pixels of the screen.
  Camera.prototype.GetSpacing = function () {
    return this.GetHeight() / this.ViewportHeight;
  };

  Camera.prototype.DeepCopy = function (inCam) {
    if (inCam.ZRange) { this.ZRange = inCam.ZRange.slice(0); }
    this.Roll = inCam.Roll;
    this.Height = inCam.Height;
    this.Width = inCam.Width;
    this.SetFocalPoint(inCam.FocalPoint);
    if (inCam.ViewportWidth) { this.ViewportWidth = inCam.ViewportWidth; }
    if (inCam.ViewportHeight) { this.ViewportHeight = inCam.ViewportHeight; }
    this.ComputeMatrix();
  };

  Camera.prototype.SetViewport = function (viewport) {
    if (10 * viewport[3] < viewport[2]) {
      // alert("Unusual viewport " + viewport[3]);
      return;
    }
    this.ViewportWidth = viewport[2];
    this.ViewportHeight = viewport[3];
    this.Width = this.Height * this.ViewportWidth / this.ViewportHeight;
    this.ComputeMatrix();
  };

  Camera.prototype.Serialize = function () {
    var obj = {};
    obj.FocalPoint = [this.FocalPoint[0], this.FocalPoint[1]];
    obj.Roll = this.Roll;
    obj.Height = this.GetHeight();
    obj.Width = this.GetWidth();
    return obj;
  };

  Camera.prototype.Load = function (obj) {
    this.SetFocalPoint(obj.FocalPoint);
    this.Roll = obj.Roll;
    this.Height = obj.Height;
    if (obj.Width) {
      this.Width = obj.Width;
    } else {
      this.Width = this.Height * this.ViewportWidth / this.ViewportHeight;
    }

    // Width is computed from height and aspect.
    this.ComputeMatrix();
  };

  // Roll is in Radians
  // Rotation is in Degrees
  Camera.prototype.GetRotation = function () {
    return this.Roll * 180.0 / 3.1415926535;
  };

  Camera.prototype.GetFocalPoint = function () {
    // Copy to avoid bugs because arrays are shared.
    // These are nasty to find.
    return [this.FocalPoint[0], this.FocalPoint[1]];
  };

  Camera.prototype.SetFocalPoint = function (fp) {
    if (isNaN(fp[0]) || isNaN(fp[1])) {
      console.log('Camera 1');
      return;
    }
    this.FocalPoint[0] = fp[0];
    this.FocalPoint[1] = fp[1];
    // Ignore z on purpose.
  };

  Camera.prototype.ConvertPointViewerToWorld = function (x, y) {
    // Convert to world coordinate system
    // Compute focal point from inverse overview camera.
    x = x / this.ViewportWidth;
    y = y / this.ViewportHeight;
    x = (x * 2.0 - 1.0) * this.Matrix[15];
    y = (1.0 - y * 2.0) * this.Matrix[15];
    var m = this.Matrix;
    var det = m[0] * m[5] - m[1] * m[4];
    var xNew = (x * m[5] - y * m[4] + m[4] * m[13] - m[5] * m[12]) / det;
    var yNew = (y * m[0] - x * m[1] - m[0] * m[13] + m[1] * m[12]) / det;

    return [xNew, yNew];
  };

  Camera.prototype.ConvertPointWorldToViewer = function (x, y) {
    var m = this.Matrix;

    // Convert from world coordinate to view (-1->1);
    var h = (x * m[3] + y * m[7] + m[15]);
    var xNew = (x * m[0] + y * m[4] + m[12]) / h;
    var yNew = (x * m[1] + y * m[5] + m[13]) / h;
    // Convert from view to screen pixel coordinates.
    xNew = (1.0 + xNew) * 0.5 * this.ViewportWidth;
    yNew = (1.0 - yNew) * 0.5 * this.ViewportHeight;

    return [xNew, yNew];
  };

  // dx, dy are in view coordinates [-0.5,0.5].
  // The camera matrix converts world to view.
  Camera.prototype.HandleTranslate = function (dx, dy) {
    // Convert view vector to world vector.
    // We could invert the matrix to get the transform, but this is easier for now.....
    var s = Math.sin(this.Roll);
    var c = Math.cos(this.Roll);
    var w = this.GetWidth();

    if (this.Mirror) {
      dy = -dy;
    }

    // Scale to world.
    dx = dx * w;
    dy = dy * w;
    // Rotate
    var rx = dx * c + dy * s;
    var ry = dy * c - dx * s;

    this.Translate(rx, ry, 0.0);
  };

  // x,y are in display coordiantes (origin at the center).
  // dx,dy are in the same coordinates system (scale).
  // Scale does not matter because we only care about rotation.
  Camera.prototype.HandleRoll = function (x, y, dx, dy) {
    // Avoid divide by zero / singularity
    if (x === 0 && y === 0) {
      return;
    }
    // Orthogonal (counter clockwise) dot dVect.
    var dRoll = -y * dx + x * dy;
    // Remove magnitude of location.
    // Scale by R to get correct angle.
    dRoll = dRoll / (x * x + y * y);
    if (this.Mirror) {
      dRoll = -dRoll;
    }
    // Keep roll in radians.
    this.Roll += dRoll;

    this.ComputeMatrix();
  };

  Camera.prototype.Translate = function (dx, dy, dz) {
    if (isNaN(dx) || isNaN(dy) || isNaN(dz)) {
      console.log('Camera 2');
      return;
    }
    // I will leave this as an exception.
    // Everything else uses SetFocalPoint([x,y]);
    this.FocalPoint[0] += dx;
    this.FocalPoint[1] += dy;
    // this.FocalPoint[2] += dz;
    this.ComputeMatrix();
  };

  Camera.prototype.GetHeight = function () {
    return this.Height;
  };

  Camera.prototype.SetHeight = function (height) {
    if (isNaN(height)) {
      console.log('Camera 3');
      return;
    }
    this.Height = height;
    // Width tracks height.
    this.Width = height * this.ViewportWidth / this.ViewportHeight;
  };

  Camera.prototype.GetWidth = function () {
    return this.Width;
  };

  Camera.prototype.SetWidth = function (width) {
    if (isNaN(width)) {
      console.log('Camera 4');
      return;
    }
    this.Width = width;
    // Width tracks height.
    this.Height = width * this.ViewportHeight / this.ViewportWidth;
  };

  Camera.prototype.SetRoll = function (roll) {
    this.Roll = roll;
  };

  // Slide coordinates.
  Camera.prototype.GetBounds = function () {
    var width = this.GetWidth();
    var bds = new Array(4);
    bds[0] = this.FocalPoint[0] - (width * 0.5);
    bds[1] = bds[0] + width;
    bds[2] = this.FocalPoint[1] - (this.Height * 0.5);
    bds[3] = bds[2] + this.Height;
    return bds;
  };

  // Camera matrix transforms points into camera coordinate system
  // X:(-1->1)
  // Y:(-1->1) (-1 is bottom)
  // Z:(-1->1) (-1 is front)
  Camera.prototype.ComputeMatrix = function () {
    var s = Math.sin(this.Roll);
    var c = Math.cos(this.Roll);
    var x = this.FocalPoint[0];
    var y = this.FocalPoint[1];
    var z = 10;
    var w = this.GetWidth();
        // var ht = this.GetHeight();  The iPad got this wrong?????
    var ht = this.Height;

    if (w < 0) { return; }

    if (this.Mirror) { ht = -ht; }

    mat4.identity(this.Matrix);

    this.Matrix[0] = c;
    this.Matrix[1] = -s * w / ht;
    this.Matrix[4] = -s;
    this.Matrix[5] = -c * w / ht;
    this.Matrix[9] = 0;
    this.Matrix[10] = (this.ZRange[1] - this.ZRange[0]) * 0.5;
    this.Matrix[12] = -c * x + s * y;
    this.Matrix[13] = -(w / ht) * (-s * x - c * y);
    this.Matrix[14] = -z + (this.ZRange[1] + this.ZRange[0]) * 0.25 * w;
    this.Matrix[15] = 0.5 * w;
  };

  // Currenly assumes parallel projection and display z range = [-1,1].
  // Also no rotation!
  // a.k.a. This method does not work.
  Camera.prototype.DisplayToWorld = function (x, y, z) {
    var scale = this.Height / this.ViewportHeight;
    x = x - (0.5 * this.ViewportWidth);
    y = y - (0.5 * this.ViewportHeight);
    var worldPt = [];
    worldPt[0] = this.FocalPoint[0] + (x * scale);
    worldPt[1] = this.FocalPoint[1] + (y * scale);
    worldPt[2] = 10 + (z * this.Height * 0.5);

    return worldPt;
  };

  Camera.prototype.AddPoint = function (x, y, z) {
    this.Points.push(x);
    this.Points.push(y);
    this.Points.push(z);
  };

  Camera.prototype.CreateBuffer = function (gl) {
    if (gl) {
      if (this.Buffer !== null) {
        gl.deleteBuffer(this.Buffer);
      }
      this.Buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.Buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.Points),
                          gl.STATIC_DRAW);
    }
  };

  // Getting rid of this.
  Camera.prototype.UpdateBuffer = function () {
    this.Points = [];
    var cx = this.FocalPoint[0];
    var cy = this.FocalPoint[1];
    var rx = this.GetWidth() * 0.5;
    var ry = this.GetHeight() * 0.5;
    this.AddPoint(cx - rx, cy - ry);
    this.AddPoint(cx + rx, cy - ry);
    this.AddPoint(cx + rx, cy + ry);
    this.AddPoint(cx - rx, cy + ry);
    this.AddPoint(cx - rx, cy - ry);
    this.CreateBuffer();
  };

  // Camera is already set.
  Camera.prototype.Draw = function (overview, gl) {
    var overviewCam = overview.Camera;
    var viewport = overview.Viewport;

    var cx = this.FocalPoint[0];
    var cy = this.FocalPoint[1];
    var rx = this.GetWidth() * 0.5;
    var ry = this.GetHeight() * 0.5;

        // To handle rotation, I need to pass the center through
        // the overview camera matrix. Coordinate system is -1->1
    var newCx = (cx * overviewCam.Matrix[0] + cy * overviewCam.Matrix[4] +
                     overviewCam.Matrix[12]) / overviewCam.Matrix[15];
    var newCy = (cx * overviewCam.Matrix[1] + cy * overviewCam.Matrix[5] +
                     overviewCam.Matrix[13]) / overviewCam.Matrix[15];

    if (gl) { /*
            // I having trouble using the overview camera, so lets just compute
            // the position of the rectangle here.
            var ocx = overviewCam.FocalPoint[0];
            var ocy = overviewCam.FocalPoint[1];
            var orx = overviewCam.GetWidth() * 0.5;
            var ory = overviewCam.GetHeight() * 0.5;

            program = SA.polyProgram;
            gl.useProgram(program);
            gl.uniform3f(program.colorUniform, 0.9, 0.0, 0.9);

            gl.viewport(viewport[0],viewport[1],viewport[2],viewport[3]);
            mat4.identity(pMatrix);
            gl.uniformMatrix4fv(program.pMatrixUniform, false, pMatrix);

            var viewFrontZ = overviewCam.ZRange[0]+0.001;

            mat4.identity(mvMatrix);
            //mvMatrix[12] = ((cx-rx)-ocx)/orx;
            //mvMatrix[13] = ((cy-ry)-ocy)/ory;
            mvMatrix[12] = newCx-(rx/orx);
            mvMatrix[13] = newCy-(ry/ory);
            mvMatrix[14] = viewFrontZ;
            mvMatrix[0] = 2*rx/orx;
            mvMatrix[5] = 2*ry/ory;

            gl.bindBuffer(gl.ARRAY_BUFFER, SA.squareOutlinePositionBuffer);
            gl.vertexAttribPointer(program.vertexPositionAttribute,
                                   SA.squareOutlinePositionBuffer.itemSize,
                                   gl.FLOAT, false, 0, 0);
            gl.uniformMatrix4fv(program.mvMatrixUniform, false, mvMatrix);
            gl.drawArrays(gl.LINE_STRIP, 0,
            SA.squareOutlinePositionBuffer.numItems);
            */
    } else {
      // Transform focal point from -1->1 to viewport
      newCx = (1.0 + newCx) * viewport[2] * 0.5;
      newCy = (1.0 - newCy) * viewport[3] * 0.5;
      // Scale width and height from world to viewport.
      rx = rx * viewport[3] / overviewCam.GetHeight();
      ry = ry * viewport[3] / overviewCam.GetHeight();

      // The 2d canvas was left in world coordinates.
      var ctx = overview.Context2d;
      /*
        ctx.beginPath();
        //ctx.strokeStyle="#E500E5";
        ctx.rect(this.FocalPoint[0]-(0.5*width),this.FocalPoint[1]-(0.5*height),width,height);
        //ctx.fillStyle="#E500E5";
        //ctx.fillRect(this.FocalPoint[0]-(0.5*width),this.FocalPoint[1]-(0.5*height),width,height);
        ctx.stroke();
      */
      ctx.save();
      // ctx.setTransform(1,0,0,1,0,0);
      // Now that the while slide / overview canvas is rotating
      // We have to rotate the rectangle.
      var c = Math.cos(this.Roll);
      var s = Math.sin(this.Roll);
      ctx.setTransform(c, -s, +s, c,
                             (1 - c) * newCx - s * newCy,
                             (1 - c) * newCy + s * newCx);

      ctx.strokeStyle = '#4011E5';
      ctx.beginPath();
      ctx.rect(newCx - rx, newCy - ry, 2 * rx, 2 * ry);
      ctx.stroke();
      ctx.restore();
    }
  };

  SAM.Camera = Camera;
})();
