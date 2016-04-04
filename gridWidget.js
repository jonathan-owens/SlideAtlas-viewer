
(function () {
    "use strict";

    var GRID_WIDGET_NEW = 0;
    var GRID_WIDGET_WAITING = 3; // The normal (resting) state.
    var GRID_WIDGET_ACTIVE = 4; // Mouse is over the widget and it is receiving events.
    var GRID_WIDGET_PROPERTIES_DIALOG = 5; // Properties dialog is up

    var GRID_WIDGET_DRAG = 6;
    var GRID_WIDGET_DRAG_LEFT = 7;
    var GRID_WIDGET_DRAG_RIGHT = 8;
    var GRID_WIDGET_DRAG_TOP = 9;
    var GRID_WIDGET_DRAG_BOTTOM = 10;
    var GRID_WIDGET_ROTATE = 11;
    // Worry about corners later.

    function Grid() {
        Shape.call(this);
        // Dimension of grid bin
        this.BinWidth = 20.0;
        this.BinHeight = 20.0;
        // Number of grid bins in x and y
        this.Dimensions = [10,8];
        this.Orientation = 0; // Angle with respect to x axis ?
        this.Origin = [10000,10000]; // middle.
        this.OutlineColor = [0,0,0];
        this.PointBuffer = [];
    };

    Grid.prototype = new Shape();

    Grid.prototype.destructor=function() {
        // Get rid of the buffers?
    };

    Grid.prototype.UpdateBuffers = function() {
        // TODO: Having a single poly line for a shape is to simple.
        // Add cell arrays.
        this.PointBuffer = [];

        if (this.Dimensions[0] < 1 || this.Dimensions[1] < 1 ||
            this.BinWidth <= 0.0 || this.BinHeight <= 0.0) {
            return;
        }

        // Matrix is computed by the draw method in Shape superclass.
        // TODO: Used to detect first initialization.
        // Get this out of this method.
        this.Matrix = mat4.create();
        mat4.identity(this.Matrix);
        //mat4.rotateZ(this.Matrix, this.Orientation / 180.0 * 3.14159);

        var totalWidth = this.BinWidth * this.Dimensions[0];
        var totalHeight = this.BinHeight * this.Dimensions[1];
        var halfWidth = totalWidth / 2;
        var halfHeight = totalHeight / 2;

        // Draw all of the x lines.
        var x = this.Dimensions[1]%2 ? 0 : totalWidth;
        var y = 0;
        this.PointBuffer.push(x-halfWidth);
        this.PointBuffer.push(y-halfHeight);
        this.PointBuffer.push(0.0);

        for (var i = 0; i < this.Dimensions[1]; ++i) {
            //shuttle back and forth.
            x = x ? 0 : totalWidth;
            this.PointBuffer.push(x-halfWidth);
            this.PointBuffer.push(y-halfHeight);
            this.PointBuffer.push(0.0);
            y += this.BinHeight;
            this.PointBuffer.push(x-halfWidth);
            this.PointBuffer.push(y-halfHeight);
            this.PointBuffer.push(0.0);
        }
        //shuttle back and forth.
        x = x ? 0 : totalWidth;
        this.PointBuffer.push(x-halfWidth);
        this.PointBuffer.push(y-halfHeight);
        this.PointBuffer.push(0.0);

        // Draw all of the y lines.
        for (var i = 0; i < this.Dimensions[0]; ++i) {
            //shuttle up and down.
            y = y ? 0 : totalHeight;
            this.PointBuffer.push(x-halfWidth);
            this.PointBuffer.push(y-halfHeight);
            this.PointBuffer.push(0.0);
            x += this.BinWidth;
            this.PointBuffer.push(x-halfWidth);
            this.PointBuffer.push(y-halfHeight);
            this.PointBuffer.push(0.0);
        }
        y = y ? 0 : totalHeight;
        this.PointBuffer.push(x-halfWidth);
        this.PointBuffer.push(y-halfHeight);
        this.PointBuffer.push(0.0);
    };


    function GridWidget (viewer, newFlag) {
        var self = this;
        this.Dialog = new Dialog(function () {self.DialogApplyCallback();});
        // Customize dialog for a circle.
        this.Dialog.Title.text('Grid Annotation Editor');

        // Grid Size
        // X
        this.Dialog.BinWidthDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display':'table-row'});
        this.Dialog.BinWidthLabel =
            $('<div>')
            .appendTo(this.Dialog.BinWidthDiv)
            .text("Bin Width:")
            .css({'display':'table-cell',
                  'text-align': 'left'});
        this.Dialog.BinWidthInput =
            $('<input>')
            .appendTo(this.Dialog.BinWidthDiv)
            .css({'display':'table-cell'})
            .keypress(function(event) { return event.keyCode != 13; });
        // Y
        this.Dialog.BinHeightDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display':'table-row'});
        this.Dialog.BinHeightLabel =
            $('<div>')
            .appendTo(this.Dialog.BinHeightDiv)
            .text("Bin Height:")
            .css({'display':'table-cell',
                  'text-align': 'left'});
        this.Dialog.BinHeightInput =
            $('<input>')
            .appendTo(this.Dialog.BinHeightDiv)
            .css({'display':'table-cell'})
            .keypress(function(event) { return event.keyCode != 13; });

        // Orientation
        this.Dialog.RotationDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display':'table-row'});
        this.Dialog.RotationLabel =
            $('<div>')
            .appendTo(this.Dialog.RotationDiv)
            .text("Rotation:")
            .css({'display':'table-cell',
                  'text-align': 'left'});
        this.Dialog.RotationInput =
            $('<input>')
            .appendTo(this.Dialog.RotationDiv)
            .css({'display':'table-cell'})
            .keypress(function(event) { return event.keyCode != 13; });

        // Color
        this.Dialog.ColorDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display':'table-row'});
        this.Dialog.ColorLabel =
            $('<div>')
            .appendTo(this.Dialog.ColorDiv)
            .text("Color:")
            .css({'display':'table-cell',
                  'text-align': 'left'});
        this.Dialog.ColorInput =
            $('<input type="color">')
            .appendTo(this.Dialog.ColorDiv)
            .val('#30ff00')
            .css({'display':'table-cell'});

        // Line Width
        this.Dialog.LineWidthDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display':'table-row'});
        this.Dialog.LineWidthLabel =
            $('<div>')
            .appendTo(this.Dialog.LineWidthDiv)
            .text("Line Width:")
            .css({'display':'table-cell',
                  'text-align': 'left'});
        this.Dialog.LineWidthInput =
            $('<input type="number">')
            .appendTo(this.Dialog.LineWidthDiv)
            .css({'display':'table-cell'})
            .keypress(function(event) { return event.keyCode != 13; });

        this.Tolerance = 0.05;
        if (MOBILE_DEVICE) {
            this.Tolerance = 0.1;
        }

        if (viewer === null) {
            return;
        }

        // Lets save the zoom level (sort of).
        // Load will overwrite this for existing annotations.
        // This will allow us to expand annotations into notes.
        this.CreationCamera = viewer.GetCamera().Serialize();

        this.Viewer = viewer;
        this.Popup = new WidgetPopup(this);
        var cam = viewer.MainView.Camera;
        var viewport = viewer.MainView.Viewport;
        this.Shape = new Grid();
        this.Shape.Origin = [0,0];
        this.Shape.OutlineColor = [0.0,0.0,0.0];
        this.Shape.SetOutlineColor('#0A0F7A');
        this.Shape.Length = 50.0*cam.Height/viewport[3];
        // Get the default bin size from the viewer scale bar.
        if (viewer.ScaleWidget) {
            this.Shape.BinWidth = viewer.ScaleWidget.LengthWorld;
        } else {
            this.Shape.BinWidth = 30*cam.Height/viewport[3];
        }
        this.Shape.BinHeight = this.Shape.BinWidth;
        this.Shape.LineWidth = 2.0*cam.Height/viewport[3];
        this.Shape.FixedSize = false;

        this.Text = new Text();
        // Shallow copy is dangerous
        this.Text.Position = this.Shape.Origin;
        this.Text.String = SA.DistanceToString(this.Shape.BinWidth*0.25e-6);
        this.Text.Color = [0.0, 0.0, 0.5];
        this.Text.Anchor = [0,0];
        this.Text.UpdateBuffers();

        // Get default properties.
        if (localStorage.GridWidgetDefaults) {
            var defaults = JSON.parse(localStorage.GridWidgetDefaults);
            if (defaults.Color) {
                this.Dialog.ColorInput.val(ConvertColorToHex(defaults.Color));
                this.Shape.SetOutlineColor(this.Dialog.ColorInput.val());
            }
            if (defaults.LineWidth != undefined) {
                this.Dialog.LineWidthInput.val(defaults.LineWidth);
                this.Shape.LineWidth == defaults.LineWidth;
            }
        }

        this.Viewer.AddWidget(this);

        // Note: If the user clicks before the mouse is in the
        // canvas, this will behave odd.

        if (newFlag) {
            this.State = GRID_WIDGET_NEW;
            this.Viewer.ActivateWidget(this);
            return;
        }

        this.State = GRID_WIDGET_WAITING;

    }


    // sign specifies which corner is origin.
    // gx, gy is the point in grid pixel coordinates offset from the corner.
    GridWidget.prototype.ComputeCorner = function(xSign, ySign, gx, gy) {
        // Pick the upper left most corner to display the grid size text.
        var xRadius = this.Shape.BinWidth * this.Shape.Dimensions[0] / 2;
        var yRadius = this.Shape.BinHeight * this.Shape.Dimensions[1] / 2;
        xRadius += gx;
        yRadius += gy;
        var x = this.Shape.Origin[0];
        var y = this.Shape.Origin[1];
        // Choose the corner from 0 to 90 degrees in the window.
        var roll = (this.Viewer.GetCamera().GetRotation()-
                    this.Shape.Orientation) / 90; // range 0-4
        roll = Math.round(roll);
        // Modulo that works with negative numbers;
        roll = ((roll % 4) + 4) % 4;
        var c = Math.cos(3.14156* this.Shape.Orientation / 180.0);
        var s = Math.sin(3.14156* this.Shape.Orientation / 180.0);
        var dx , dy;
        if (roll == 0) {
            dx =  xSign*xRadius;
            dy =  ySign*yRadius;
        } else if (roll == 3) {
            dx =  xSign*xRadius;
            dy = -ySign*yRadius;
        } else if (roll == 2) {
            dx = -xSign*xRadius;
            dy = -ySign*yRadius;
        } else if (roll == 1) {
            dx = -xSign*xRadius;
            dy =  ySign*yRadius;
        }
        x = x + c*dx + s*dy;
        y = y + c*dy - s*dx;

        return [x,y];
    }

    GridWidget.prototype.Draw = function(view) {
        this.Shape.Draw(view);

        // Corner in grid pixel coordinates.
        var x = - (this.Shape.BinWidth * this.Shape.Dimensions[0] / 2);
        var y = - (this.Shape.BinHeight * this.Shape.Dimensions[1] / 2);
        this.Text.Anchor = [0,20];
        this.Text.Orientation = (this.Shape.Orientation -
                                 this.Viewer.GetCamera().GetRotation());
        // Modulo that works with negative numbers;
        this.Text.Orientation = ((this.Text.Orientation % 360) + 360) % 360;
        // Do not draw text upside down.
        if (this.Text.Orientation > 90 && this.Text.Orientation < 270) {
            this.Text.Orientation -= 180.0;
            this.Text.Anchor = [this.Text.PixelBounds[1],0];
            //x += this.Text.PixelBounds[1]; // wrong units (want world
            //pixels , this is screen pixels).
        }
        // Convert to world Coordinates.
        var radians = this.Shape.Orientation * Math.PI / 180;
        var c = Math.cos(radians);
        var s = Math.sin(radians);
        var wx = c*x + s*y;
        var wy = c*y - s*x;
        this.Text.Position = [this.Shape.Origin[0]+wx,this.Shape.Origin[1]+wy];

                                 
        this.Text.Draw(view);
    };

    // This needs to be put in the Viewer.
    GridWidget.prototype.RemoveFromViewer = function() {
        if (this.Viewer) {
            this.Viewer.RemoveWidget(this);
        }
    };

    GridWidget.prototype.PasteCallback = function(data, mouseWorldPt, camera) {
        this.Load(data);
        // Keep the pasted grid from rotating when the camera changes.
        var dr = this.Viewer.GetCamera().GetRotation() -
        camera.GetRotation();
        this.Shape.Orientation += dr;
        // Place the widget over the mouse.
        // This would be better as an argument.
        this.Shape.Origin = [mouseWorldPt[0], mouseWorldPt[1]];
        this.Text.Position = [mouseWorldPt[0], mouseWorldPt[1]];

        eventuallyRender();
    };

    GridWidget.prototype.Serialize = function() {
        if(this.Shape === undefined){ return null; }
        var obj = {};
        obj.type = "grid";
        obj.origin = this.Shape.Origin;
        obj.outlinecolor = this.Shape.OutlineColor;
        obj.bin_width = this.Shape.BinWidth;
        obj.bin_height = this.Shape.BinHeight;
        obj.dimensions = this.Shape.Dimensions;
        obj.orientation = this.Shape.Orientation;
        obj.linewidth = this.Shape.LineWidth;
        obj.creation_camera = this.CreationCamera;
        return obj;
    };

    // Load a widget from a json object (origin MongoDB).
    GridWidget.prototype.Load = function(obj) {
        this.Shape.Origin[0] = parseFloat(obj.origin[0]);
        this.Shape.Origin[1] = parseFloat(obj.origin[1]);
        this.Shape.OutlineColor[0] = parseFloat(obj.outlinecolor[0]);
        this.Shape.OutlineColor[1] = parseFloat(obj.outlinecolor[1]);
        this.Shape.OutlineColor[2] = parseFloat(obj.outlinecolor[2]);
        if (obj.width)  { this.Shape.BinWidth = parseFloat(obj.width);}
        if (obj.height) {this.Shape.BinHeight = parseFloat(obj.height);}
        if (obj.bin_width)  { this.Shape.BinWidth = parseFloat(obj.bin_width);}
        if (obj.bin_height) {this.Shape.BinHeight = parseFloat(obj.bin_height);}
        this.Shape.Dimensions[0] = parseInt(obj.dimensions[0]);
        this.Shape.Dimensions[1] = parseInt(obj.dimensions[1]);
        this.Shape.Orientation = parseFloat(obj.orientation);
        this.Shape.LineWidth = parseFloat(obj.linewidth);
        this.Shape.FixedSize = false;
        this.Shape.UpdateBuffers();

        this.Text.String = SA.DistanceToString(this.Shape.BinWidth*0.25e-6);
        // Shallow copy is dangerous
        this.Text.Position = this.Shape.Origin;
        this.Text.UpdateBuffers();

        // How zoomed in was the view when the annotation was created.
        if (obj.creation_camera !== undefined) {
            this.CreationCamera = obj.CreationCamera;
        }
    };

    GridWidget.prototype.HandleKeyPress = function(keyCode, shift) {
        // The dialog consumes all key events.
        if (this.State == GRID_WIDGET_PROPERTIES_DIALOG) {
            return false;
        }

        // Copy
        if (event.keyCode == 67 && event.ctrlKey) {
            //control-c for copy
            //The extra identifier is not needed for widgets, but will be
            // needed if we have some other object on the clipboard.
            // The camera is needed so grid does not rotate when pasting in
            // another stack section.
            var clip = {Type:"GridWidget", 
                        Data: this.Serialize(), 
                        Camera: this.Viewer.GetCamera().Serialize()};
            localStorage.ClipBoard = JSON.stringify(clip);
            return false;
        }

        return true;
    };

    GridWidget.prototype.HandleDoubleClick = function(event) {
        return true;
    };

    GridWidget.prototype.HandleMouseDown = function(event) {
        if (event.which != 1) {
            return true;
        }
        this.DragLast = this.Viewer.ConvertPointViewerToWorld(event.offsetX, event.offsetY);
        return false;
    };

    // returns false when it is finished doing its work.
    GridWidget.prototype.HandleMouseUp = function(event) {
        this.SetActive(false);
        RecordState();

        return true;
    };

    // Orientation is a pain,  we need a world to shape transformation.
    GridWidget.prototype.HandleMouseMove = function(event) {
        if (event.which == 1) {
            var world =
    this.Viewer.ConvertPointViewerToWorld(event.offsetX, event.offsetY);
            var dx, dy;
            if (this.State == GRID_WIDGET_DRAG) {
                dx = world[0] - this.DragLast[0];
                dy = world[1] - this.DragLast[1];
                this.DragLast = world;
                this.Shape.Origin[0] += dx;
                this.Shape.Origin[1] += dy;
            } else {
                // convert mouse from world to Shape coordinate system.
                dx = world[0] - this.Shape.Origin[0];
                dy = world[1] - this.Shape.Origin[1];
                var c = Math.cos(3.14156* this.Shape.Orientation / 180.0);
                var s = Math.sin(3.14156* this.Shape.Orientation / 180.0);
                var x = c*dx - s*dy;
                var y = c*dy + s*dx;
                // convert from shape to integer grid indexes.
                x = (0.5*this.Shape.Dimensions[0]) + (x / this.Shape.BinWidth);
                y = (0.5*this.Shape.Dimensions[1]) + (y / this.Shape.BinHeight);
                var ix = Math.round(x);
                var iy = Math.round(y);
                // Change grid dimemsions
                dx = dy = 0;
                var changed = false;
                if (this.State == GRID_WIDGET_DRAG_RIGHT) {
                    dx = ix - this.Shape.Dimensions[0];
                    if (dx) {
                        this.Shape.Dimensions[0] = ix;
                        // Compute the change in the center point origin.
                        dx = 0.5 * dx * this.Shape.BinWidth;
                        changed = true;
                    }
                } else if (this.State == GRID_WIDGET_DRAG_LEFT) {
                    if (ix) {
                        this.Shape.Dimensions[0] -= ix;
                        // Compute the change in the center point origin.
                        dx = 0.5 * ix * this.Shape.BinWidth;
                        changed = true;
                    }
                } else if (this.State == GRID_WIDGET_DRAG_BOTTOM) {
                    dy = iy - this.Shape.Dimensions[1];
                    if (dy) {
                        this.Shape.Dimensions[1] = iy;
                        // Compute the change in the center point origin.
                        dy = 0.5 * dy * this.Shape.BinHeight;
                        changed = true;
                    }
                } else if (this.State == GRID_WIDGET_DRAG_TOP) {
                    if (iy) {
                        this.Shape.Dimensions[1] -= iy;
                        // Compute the change in the center point origin.
                        dy = 0.5 * iy * this.Shape.BinHeight;
                        changed = true;
                    }
                }
                if (changed) {
                    // Rotate the translation and apply to the center.
                    x = c*dx + s*dy;
                    y = c*dy - s*dx;
                    this.Shape.Origin[0] += x;
                    this.Shape.Origin[1] += y;
                    this.Shape.UpdateBuffers();
                }
            }
            eventuallyRender();
            return
        }

        this.CheckActive(event);

        return true;
    };


    GridWidget.prototype.HandleMouseWheel = function(event) {
        /*
        var x = event.offsetX;
        var y = event.offsetY;

        if (this.State == GRID_WIDGET_ACTIVE) {
            if(this.NormalizedActiveDistance < 0.5) {
                var ratio = 1.05;
                var direction = 1;
                if(event.wheelDelta < 0) {
                     ratio = 0.95;
                    direction = -1;
                }
                if(event.shiftKey) {
                    this.Shape.Length = this.Shape.Length * ratio;
                }
                if(event.ctrlKey) {
                    this.Shape.BinWidth = this.Shape.BinWidth * ratio;
                }
                if(!event.shiftKey && !event.ctrlKey) {
                    this.Shape.Orientation = this.Shape.Orientation + 3 * direction;
                 }

                this.Shape.UpdateBuffers();
                this.PlacePopup();
                eventuallyRender();
            }
        }
        */
    };


    GridWidget.prototype.HandleTouchPan = function(event) {
        /*
          w0 = this.Viewer.ConvertPointViewerToWorld(EVENT_MANAGER.LastMouseX,
          EVENT_MANAGER.LastMouseY);
          w1 = this.Viewer.ConvertPointViewerToWorld(event.offsetX,event.offsetY);

          // This is the translation.
          var dx = w1[0] - w0[0];
          var dy = w1[1] - w0[1];

          this.Shape.Origin[0] += dx;
          this.Shape.Origin[1] += dy;
          eventuallyRender();
        */
        return true;
    };


    GridWidget.prototype.HandleTouchPinch = function(event) {
        //this.Shape.UpdateBuffers();
        //eventuallyRender();
        return true;
    };

    GridWidget.prototype.HandleTouchEnd = function(event) {
        this.SetActive(false);
    };


    GridWidget.prototype.CheckActive = function(event) {
        var x,y;
        if (this.Shape.FixedSize) {
            x = event.offsetX;
            y = event.offsetY;
            pixelSize = 1;
        } else {
            x = event.worldX;
            y = event.worldY;
        }
        x = x - this.Shape.Origin[0];
        y = y - this.Shape.Origin[1];
        // Rotate to grid.
        var c = Math.cos(3.14156* this.Shape.Orientation / 180.0);
        var s = Math.sin(3.14156* this.Shape.Orientation / 180.0);
        var rx = c*x - s*y;
        var ry = c*y + s*x;

        // Convert to grid coordinates (0 -> dims)
        x = (0.5*this.Shape.Dimensions[0]) + (rx / this.Shape.BinWidth);
        y = (0.5*this.Shape.Dimensions[1]) + (ry / this.Shape.BinHeight);
        var ix = Math.round(x);
        var iy = Math.round(y);
        if (ix < 0 || ix > this.Shape.Dimensions[0] ||
            iy < 0 || iy > this.Shape.Dimensions[1]) {
            this.SetActive(false);
            return false;
        }

        // x,y get the residual in pixels.
        x = (x - ix) * this.Shape.BinWidth;
        y = (y - iy) * this.Shape.BinHeight;

        // Compute the screen pixel size for tollerance.
        var tolerance = 5.0 / this.Viewer.GetPixelsPerUnit();

        if (Math.abs(x) < tolerance || Math.abs(y) < tolerance) {
            this.SetActive(true);
            if (ix == 0) {
                this.State = GRID_WIDGET_DRAG_LEFT;
                this.Viewer.MainView.CanvasDiv.css({'cursor':'col-resize'});
            } else if (ix == this.Shape.Dimensions[0]) {
                this.State = GRID_WIDGET_DRAG_RIGHT;
                this.Viewer.MainView.CanvasDiv.css({'cursor':'col-resize'});
            } else if (iy == 0) {
                this.State = GRID_WIDGET_DRAG_TOP;
                this.Viewer.MainView.CanvasDiv.css({'cursor':'row-resize'});
            } else if (iy == this.Shape.Dimensions[1]) {
                this.State = GRID_WIDGET_DRAG_BOTTOM;
                this.Viewer.MainView.CanvasDiv.css({'cursor':'row-resize'});
            } else {
                this.State = GRID_WIDGET_DRAG;
                this.Viewer.MainView.CanvasDiv.css({'cursor':'move'});
            }
            return true;
        }

        this.SetActive(false);
        return false;
    };

    // Multiple active states. Active state is a bit confusing.
    GridWidget.prototype.GetActive = function() {
        if (this.State == GRID_WIDGET_WAITING) {
            return false;
        }
        return true;
    };


    GridWidget.prototype.Deactivate = function() {
        this.Viewer.MainView.CanvasDiv.css({'cursor':'default'});
        this.Popup.StartHideTimer();
        this.State = GRID_WIDGET_WAITING;
        this.Shape.Active = false;
        this.Viewer.DeactivateWidget(this);
        if (this.DeactivateCallback) {
            this.DeactivateCallback();
        }
        eventuallyRender();
    };

    // Setting to active always puts state into "active".
    // It can move to other states and stay active.
    GridWidget.prototype.SetActive = function(flag) {
        if (flag == this.GetActive()) {
            return;
        }

        if (flag) {
            this.State = GRID_WIDGET_ACTIVE;
            this.Shape.Active = true;
            this.Viewer.ActivateWidget(this);
            eventuallyRender();
            // Compute the location for the pop up and show it.
            this.PlacePopup();
        } else {
            this.Deactivate();
        }
        eventuallyRender();
    };


    // This also shows the popup if it is not visible already.
    GridWidget.prototype.PlacePopup = function () {
        // Compute corner has its angle backwards.  I do not see how this works.
        var pt = this.ComputeCorner(1, -1, 0, 0);
        pt = this.Viewer.ConvertPointWorldToViewer(pt[0], pt[1]);
        this.Popup.Show(pt[0]+10,pt[1]-30);
    };

    // Can we bind the dialog apply callback to an objects method?
    var GRID_WIDGET_DIALOG_SELF;

    GridWidget.prototype.ShowPropertiesDialog = function () {
        this.Dialog.ColorInput.val(ConvertColorToHex(this.Shape.OutlineColor));
        this.Dialog.LineWidthInput.val((this.Shape.LineWidth).toFixed(2));
        // convert 40x scan pixels into meters
        this.Dialog.BinWidthInput.val(SA.DistanceToString(this.Shape.BinWidth*0.25e-6));
        this.Dialog.BinHeightInput.val(SA.DistanceToString(this.Shape.BinHeight*0.25e-6));
        this.Dialog.RotationInput.val(this.Shape.Orientation);

        this.Dialog.Show(true);
    };

    GridWidget.prototype.DialogApplyCallback = function() {
        var hexcolor = this.Dialog.ColorInput.val();
        this.Shape.SetOutlineColor(hexcolor);
        this.Shape.LineWidth = parseFloat(this.Dialog.LineWidthInput.val());
        this.Shape.BinWidth = SA.StringToDistance(this.Dialog.BinWidthInput.val())*4e6;
        this.Shape.BinHeight = SA.StringToDistance(this.Dialog.BinHeightInput.val())*4e6;
        this.Shape.Orientation = parseFloat(this.Dialog.RotationInput.val());
        this.Shape.UpdateBuffers();
        this.SetActive(false);

        this.Text.String = SA.DistanceToString(this.Shape.BinWidth*0.25e-6);
        this.Text.UpdateBuffers();

        RecordState();
        eventuallyRender();

        localStorage.GridWidgetDefaults = JSON.stringify({Color: hexcolor, LineWidth: this.Shape.LineWidth});
    };

    window.GridWidget = GridWidget;

})();