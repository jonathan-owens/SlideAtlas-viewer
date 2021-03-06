// Since there is already a rectangle widget (for axis aligned rectangle)
// renaming this as Rect, other possible name is OrientedRectangle

(function () {
  // Depends on the CIRCLE widget
  'use strict';

  var WAITING = 0;     // Normal inactive resting state.
  var NEW = 1;         // Newly created and waigint to be placed.
  var ACTIVE = 2;      // Mouse is over the widget and it is receiving events.
  var PROPERTIES_DIALOG = 3; // Properties dialog is up
  var WHICH_DRAG;    // Bits
  var DRAG_X = 1;
  var DRAG_Y = 2;
  var DRAG_CENTER = 4;

  // Remember the last size to use for the next.
  var DEFAULT_WIDTH = -1;
  var DEFAULT_HEIGHT = -1;

  function Rect () {
    SAM.Shape.call(this);

    this.Width = 50;
    this.Height = 50;
    this.Orientation = 0; // Angle with respect to x axis ?
    this.Origin = [10000, 10000]; // Center in world coordinates.
    this.OutlineColor = [0, 0, 0];
    this.PointBuffer = [];
  }

  Rect.prototype = new SAM.Shape();

  Rect.prototype.destructor = function () {
    // Get rid of the buffers?
  };

  Rect.prototype.UpdateBuffers = function (view) {
    this.PointBuffer = [];

    this.Matrix = mat4.create();
    mat4.identity(this.Matrix);
    mat4.rotateZ(this.Matrix, this.Orientation / 180.0 * 3.14159);

    this.PointBuffer.push(1 * this.Width / 2.0);
    this.PointBuffer.push(1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(-1 * this.Width / 2.0);
    this.PointBuffer.push(1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(-1 * this.Width / 2.0);
    this.PointBuffer.push(-1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(1 * this.Width / 2.0);
    this.PointBuffer.push(-1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);

    this.PointBuffer.push(1 * this.Width / 2.0);
    this.PointBuffer.push(1 * this.Height / 2.0);
    this.PointBuffer.push(0.0);
  };

  function RectWidget (layer, newFlag) {
    this.Visibility = true;
    // Keep track of annotation created by students without edit
    // permission.
    this.UserNoteFlag = !SA.Edit;

    var self = this;
    this.Dialog = new SAM.Dialog(function () { self.DialogApplyCallback(); });
    // Customize dialog for a circle.
    this.Dialog.Title.text('Rect Annotation Editor');
    // Color
    this.Dialog.ColorDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display': 'table-row'});
    this.Dialog.ColorLabel =
            $('<div>')
            .appendTo(this.Dialog.ColorDiv)
            .text('Color:')
            .css({'display': 'table-cell',
              'text-align': 'left'});
    this.Dialog.ColorInput =
            $('<input type="color">')
            .appendTo(this.Dialog.ColorDiv)
            .val('#30ff00')
            .css({'display': 'table-cell'});

    // Line Width
    this.Dialog.LineWidthDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display': 'table-row'});
    this.Dialog.LineWidthLabel =
            $('<div>')
            .appendTo(this.Dialog.LineWidthDiv)
            .text('Line Width:')
            .css({'display': 'table-cell',
              'text-align': 'left'});
    this.Dialog.LineWidthInput =
            $('<input type="number">')
            .appendTo(this.Dialog.LineWidthDiv)
            .css({'display': 'table-cell'})
            .keypress(function (event) { return event.keyCode !== 13; });

    // Area
    this.Dialog.AreaDiv =
            $('<div>')
            .appendTo(this.Dialog.Body)
            .css({'display': 'table-row'});
    this.Dialog.AreaLabel =
            $('<div>')
            .appendTo(this.Dialog.AreaDiv)
            .text('Area:')
            .css({'display': 'table-cell',
              'text-align': 'left'});
    this.Dialog.Area =
            $('<div>')
            .appendTo(this.Dialog.AreaDiv)
            .css({'display': 'table-cell'});

    // Get default properties.
    if (localStorage.RectWidgetDefaults) {
      var defaults = JSON.parse(localStorage.RectWidgetDefaults);
      if (defaults.Color) {
        this.Dialog.ColorInput.val(SAM.ConvertColorToHex(defaults.Color));
      }
      this.Dialog.LineWidthInput.val(0);
      if (defaults.LineWidth) {
        this.Dialog.LineWidthInput.val(defaults.LineWidth);
      }
    }

    this.Tolerance = 0.05;
    if (SAM.detectMobile()) {
      this.Tolerance = 0.1;
    }

    if (layer === null) {
      return;
    }

    // Lets save the zoom level (sort of).
    // Load will overwrite this for existing annotations.
    // This will allow us to expand annotations into notes.
    this.CreationCamera = layer.GetCamera().Serialize();

    this.Layer = layer;
    this.Popup = new SAM.WidgetPopup(this);
    var cam = layer.GetCamera();
    var viewport = layer.GetViewport();
    this.Shape = new Rect();
    this.Shape.Orientation = cam.GetRotation();
    this.Shape.Origin = [0, 0];
    this.Shape.OutlineColor = [0.0, 0.0, 0.0];
    this.Shape.SetOutlineColor(this.Dialog.ColorInput.val());
    if (DEFAULT_WIDTH > 0) {
      this.Shape.Height = DEFAULT_HEIGHT;
      this.Shape.Width = DEFAULT_WIDTH;
    } else {
      this.Shape.Height = 50.0 * cam.Height / viewport[3];
      this.Shape.Width = 50.0 * cam.Height / viewport[3];
    }
    this.Shape.LineWidth = 0;
    this.Shape.FixedSize = false;

    this.Layer.AddWidget(this);

    // Note: If the user clicks before the mouse is in the
    // canvas, this will behave odd.

    if (newFlag) {
      this.State = NEW;
      // Do not render mouse "cursor" unti it moves and we know its location.
      this.Visibility = false;
      this.Layer.ActivateWidget(this);
      this.Layer.GetCanvasDiv().css({'cursor': 'crosshair'});
      return;
    }

    this.Layer.GetCanvasDiv().css({'cursor': 'default'});
    this.State = WAITING;
  }

  // Threshold above is the only option for now.
  RectWidget.prototype.SetThreshold = function (threshold) {
    if (this.confidence !== undefined) {
      this.Visibility = this.confidence >= threshold;
    }
  };

  RectWidget.prototype.Draw = function (view) {
    // shape follows the cursor
    if (this.Visibility) {
      this.Shape.Draw(view);
    }
  };

  RectWidget.prototype.PasteCallback = function (data, mouseWorldPt) {
    this.Load(data);
    // Place the widget over the mouse.
    // This would be better as an argument.
    this.Shape.Origin = [mouseWorldPt[0], mouseWorldPt[1]];
    this.Layer.EventuallyDraw();
    if (this.UserNoteFlag && SA.notesWidget) { SA.notesWidget.EventuallySaveUserNote(); }
    if (SAM.NotesWidget && !this.UserNoteFlag) { SAM.NotesWidget.MarkAsModified(); } // Hack
  };

  RectWidget.prototype.Serialize = function () {
    if (this.Shape === undefined) { return null; }
    var obj = {};
    obj.type = 'rect';
    obj.user_note_flag = this.UserNoteFlag;
    obj.origin = this.Shape.Origin;
    obj.origin[2] = 0.0;
    obj.outlinecolor = this.Shape.OutlineColor;
    obj.height = this.Shape.Height;
    obj.width = this.Shape.Width;
    obj.orientation = this.Shape.Orientation;
    obj.linewidth = this.Shape.LineWidth;
    obj.creation_camera = this.CreationCamera;
    return obj;
  };

  // Load a widget from a json object (origin MongoDB).
  RectWidget.prototype.Load = function (obj) {
    this.UserNoteFlag = obj.user_note_flag;
    this.Shape.Origin[0] = parseFloat(obj.origin[0]);
    this.Shape.Origin[1] = parseFloat(obj.origin[1]);
    if (obj.outlinecolor) {
      this.Shape.OutlineColor[0] = parseFloat(obj.outlinecolor[0]);
      this.Shape.OutlineColor[1] = parseFloat(obj.outlinecolor[1]);
      this.Shape.OutlineColor[2] = parseFloat(obj.outlinecolor[2]);
    }
    this.Shape.Width = parseFloat(obj.width);
    if (obj.confidence) {
      this.confidence = parseFloat(obj.confidence);
    }
    if (obj.length) {
      this.Shape.Height = parseFloat(obj.length);
    }
    if (obj.height) {
      this.Shape.Height = parseFloat(obj.height);
    }
    if (obj.orientation) {
      this.Shape.Orientation = parseFloat(obj.orientation);
    }
    if (obj.linewidth !== undefined) {
      this.Shape.LineWidth = parseFloat(obj.linewidth);
    }
    this.Shape.FixedSize = false;
    this.Shape.UpdateBuffers(this.Layer.AnnotationView);

    // How zoomed in was the view when the annotation was created.
    if (obj.creation_camera !== undefined) {
      this.CreationCamera = obj.CreationCamera;
    }
  };

  RectWidget.prototype.HandleKeyDown = function (keyCode, shift) {
    if (!this.Visibility) {
      return true;
    }

    // The dialog consumes all key events.
    if (this.State === PROPERTIES_DIALOG) {
      return false;
    }

    if (this.State === NEW) {
      // escape key (or space or enter) to turn off drawing
      if (event.keyCode === 27 || event.keyCode === 32 || event.keyCode === 13) {
        this.Deactivate();
                // this widget was temporary, All rects created have been copied.
        this.RemoveFromLayer();
        return false;
      }
    }

    // Copy
    if (event.keyCode === 67 && event.ctrlKey) {
      // control-c for copy
      // The extra identifier is not needed for widgets, but will be
      // needed if we have some other object on the clipboard.
      var clip = {Type: 'RectWidget', Data: this.Serialize()};
      localStorage.ClipBoard = JSON.stringify(clip);
      return false;
    }

    return true;
  };

  RectWidget.prototype.HandleDoubleClick = function (event) {
    if (this.State === NEW) {
      this.Deactivate();
      // this widget was temporary, All rects created have been copied.
      this.RemoveFromLayer();
      return false;
    }
    if (this.State === ACTIVE) {
      // Start adding again
      // Duplicate this widget and keep on drawing.
      var copy = new RectWidget(this.Layer, false);
      copy.Load(this.Serialize());
      this.State = WAITING;
      if (window.SA) { SA.RecordState(); }

      DEFAULT_WIDTH = this.Shape.Width;
      DEFAULT_HEIGHT = this.Shape.Height;
    }
  };

  RectWidget.prototype.HandleMouseDown = function (event) {
    if (!this.Visibility) {
      return true;
    }

    if (event.which !== 1) {
      return false;
    }
    return false;
  };

  RectWidget.prototype.HandleMouseMove = function (event) {
    var x = event.offsetX;
    var y = event.offsetY;

    // Mouse moving with no button pressed:
    if (event.which === 0) {
      // This keeps the rectangle from being drawn in the wrong place
      // before we get our first event.
      if (this.State === NEW) {
        WHICH_DRAG = DRAG_X + DRAG_Y;
        // THis is ignored until the mouse is pressed.
        this.Visibility = true;
        // Center follows mouse.
        this.Shape.Origin = this.Layer.GetCamera().ConvertPointViewerToWorld(x, y);
        this.Layer.EventuallyDraw();
        return false;
      } else if (this.State === ACTIVE) {
        // HandleMouseMove will not be called if the widget is waiting.
        // This turns the widget off when the mouse moves away.
        this.SetActive(this.CheckActive(event));
        return false;
      }
    }

    // Is this really necesary?
    if (!this.Visibility) {
      return true;
    }

    if (event.which !== 1) { return false; }

    var worldPt = this.Layer.GetCamera().ConvertPointViewerToWorld(x, y);
    if (this.State === ACTIVE && WHICH_DRAG === DRAG_CENTER) {
      // Drag the whole thing.
      this.Shape.Origin = worldPt;
    } else if (this.State === ACTIVE || this.State === NEW) {
      // Drag a corner (or an edge)
      if (WHICH_DRAG & DRAG_X) {
        var dx = Math.abs(worldPt[0] - this.Shape.Origin[0]);
        this.Shape.Width = 2 * dx;
      }
      if (WHICH_DRAG & DRAG_Y) {
        var dy = Math.abs(worldPt[1] - this.Shape.Origin[1]);
        this.Shape.Height = 2 * dy;
      }
    }

    this.Shape.UpdateBuffers();
    this.PlacePopup();
    this.Layer.EventuallyDraw();
    return false;
  };

  // returns false when it is finished doing its work.
  RectWidget.prototype.HandleMouseUp = function (event) {
    if (!this.Visibility) {
      return true;
    }

    if (this.State === NEW) {
      this.NewAddAndContinue();
    }
    DEFAULT_WIDTH = this.Shape.Width;
    DEFAULT_HEIGHT = this.Shape.Height;
  };

  // returns false when it is finished doing its work.
  RectWidget.prototype.HandleClick = function (event) {
    if (!this.Visibility) {
      return true;
    }

    if (this.State === NEW) {
      this.NewAddAndContinue();
    }
  };

  // Make the "new" rect permenant and add another "new" rectangle
  // so multiple rectangles can be added quickly.
  RectWidget.prototype.NewAddAndContinue = function () {
    // TODO: Ripout this usernote stuff and replace with modified callbacks.
    if (this.UserNoteFlag && SA.notesWidget) { SA.notesWidget.EventuallySaveUserNote(); }
    if (SAM.NotesWidget && !this.UserNoteFlag) { SAM.NotesWidget.MarkAsModified(); } // Hack
    // Duplicate this widget and keep on drawing.
    var copy = new RectWidget(this.Layer, true);
    copy.Load(this.Serialize());
    // The old one becomes inactive and the copy takes over.
    this.State = WAITING;
    if (window.SA) { SA.RecordState(); }
  };

  RectWidget.prototype.HandleTouchPan = function (event) {
    if (!this.Visibility) {
      return true;
    }

    var w0 = this.Layer.GetCamera().ConvertPointViewerToWorld(this.Layer.LastMouseX,
                                                              this.Layer.LastMouseY);
    var w1 = this.Layer.GetCamera().ConvertPointViewerToWorld(event.offsetX, event.offsetY);

    // This is the translation.
    var dx = w1[0] - w0[0];
    var dy = w1[1] - w0[1];

    this.Shape.Origin[0] += dx;
    this.Shape.Origin[1] += dy;
    this.Layer.EventuallyDraw();
  };

  RectWidget.prototype.HandleTouchPinch = function (event) {
    if (!this.Visibility) {
      return true;
    }

    this.Shape.UpdateBuffers(this.Layer.AnnotationView);
    this.Layer.EventuallyDraw();
  };

  RectWidget.prototype.HandleTouchEnd = function (event) {
    if (!this.Visibility) {
      return true;
    }

    this.SetActive(false);
    if (this.UserNoteFlag && SA.notesWidget) { SA.notesWidget.EventuallySaveUserNote(); }
    if (SAM.NotesWidget && !this.UserNoteFlag) { SAM.NotesWidget.MarkAsModified(); } // Hack
  };

  RectWidget.prototype.CheckActive = function (event) {
    if (!this.Visibility) {
      return false;
    }

    var dx, dy;
    // change dx and dy to vector from center of circle.
    if (this.FixedSize) {
      dx = Math.abs(event.offsetX - this.Shape.Origin[0]);
      dy = Math.abs(event.offsetY - this.Shape.Origin[1]);
    } else {
      dx = Math.abs(event.worldX - this.Shape.Origin[0]);
      dy = Math.abs(event.worldY - this.Shape.Origin[1]);
    }

    // Tolerance
    var tol = this.Shape.LineWidth +
      Math.min(this.Shape.Width, this.Shape.Height) / 20.0;

    // TODO: Handle orientation
    // Terminiate if outside bounds.
    if (dx > tol + (this.Shape.Width / 2.0) ||
        dy > tol + (this.Shape.Height / 2.0)) {
      this.SetActive(false);
      return false;
    }

    // TODO: Handle overlapping widgets with a priority.
    // TODO: center icon
    // First see if we are over the center.
    if (dx < tol && dy < tol) {
      WHICH_DRAG = DRAG_CENTER;
      this.SetActive(true);
      return true;
    }

    WHICH_DRAG = 0;
    if (Math.abs(dx - this.Shape.Width / 2) < tol) {
      WHICH_DRAG += DRAG_X;
    }
    if (Math.abs(dy - this.Shape.Height / 2) < tol) {
      WHICH_DRAG += DRAG_Y;
    }

    if (WHICH_DRAG === 0) {
      this.SetActive(false);
      return false;
    }
    this.SetActive(true);
    return true;
  };

  // Multiple active states. Active state is a bit confusing.
  RectWidget.prototype.GetActive = function () {
    if (this.State === WAITING) {
      return false;
    }
    return true;
  };

  RectWidget.prototype.RemoveFromLayer = function () {
    if (this.Layer) {
      this.Layer.RemoveWidget(this);
    }
    this.Layer = null;
  };

  RectWidget.prototype.Deactivate = function () {
    this.Popup.StartHideTimer();
    this.Layer.GetCanvasDiv().css({'cursor': 'default'});
    this.Layer.DeactivateWidget(this);
    this.State = WAITING;
    this.Shape.Active = false;
    if (this.DeactivateCallback) {
      this.DeactivateCallback();
    }
    this.Layer.EventuallyDraw();
  };

  // Setting to active always puts state into "active".
  // It can move to other states and stay active.
  RectWidget.prototype.SetActive = function (flag) {
    if (!this.Visibility) {
      this.Visibility = true;
    }

    if (flag === this.GetActive()) {
      return;
    }

    if (flag) {
      this.State = ACTIVE;
      this.Shape.Active = true;
      this.Layer.ActivateWidget(this);
      this.Layer.EventuallyDraw();
      // Compute the location for the pop up and show it.
      this.PlacePopup();
    } else {
      this.Deactivate();
    }
    this.Layer.EventuallyDraw();
  };

  // This also shows the popup if it is not visible already.
  RectWidget.prototype.PlacePopup = function () {
    if (!this.Visibility) {
      return;
    }
    // Compute the location for the pop up and show it.
    var roll = this.Layer.GetCamera().Roll;
    var rad = this.Shape.Width * 0.5;
    var x = this.Shape.Origin[0] + 0.8 * rad * (Math.cos(roll) - Math.sin(roll));
    var y = this.Shape.Origin[1] - 0.8 * rad * (Math.cos(roll) + Math.sin(roll));
    var pt = this.Layer.GetCamera().ConvertPointWorldToViewer(x, y);
    this.Popup.Show(pt[0], pt[1]);
  };

  RectWidget.prototype.ShowPropertiesDialog = function () {
    this.Dialog.ColorInput.val(SAM.ConvertColorToHex(this.Shape.OutlineColor));

    this.Dialog.LineWidthInput.val((this.Shape.LineWidth).toFixed(2));

    var rad = this.Shape.Width * 0.5;
    var area = (2.0 * Math.PI * rad * rad) * 0.25 * 0.25;
    var areaString = '';
    if (this.Shape.FixedSize) {
      areaString += area.toFixed(2);
      areaString += ' pixels^2';
    } else {
      if (area > 1000000) {
        areaString += (area / 1000000).toFixed(2);
        areaString += ' mm^2';
      } else {
        areaString += area.toFixed(2);
        areaString += ' um^2';
      }
    }
    this.Dialog.Area.text(areaString);

    this.Dialog.Show(true);
  };

  RectWidget.prototype.DialogApplyCallback = function () {
    var hexcolor = this.Dialog.ColorInput.val();
    this.Shape.SetOutlineColor(hexcolor);
    this.Shape.LineWidth = parseFloat(this.Dialog.LineWidthInput.val());
    this.Shape.UpdateBuffers(this.Layer.AnnotationView);
    this.SetActive(false);
    if (window.SA) { SA.RecordState(); }
    this.Layer.EventuallyDraw();

    if (this.UserNoteFlag && SA.notesWidget) { SA.notesWidget.EventuallySaveUserNote(); }
    if (SAM.NotesWidget && !this.UserNoteFlag) { SAM.NotesWidget.MarkAsModified(); } // Hack
    localStorage.RectWidgetDefaults = JSON.stringify(
      {Color: hexcolor,
        LineWidth: this.Shape.LineWidth});
  };

  SAM.RectWidget = RectWidget;
})();
