// ==============================================================================

(function () {
  'use strict';

  // TODO: Fix
  // Add stack option to Save large image GUI.
  // SaveStackImages.

  // I think this can go away now that we have hover mode in text.

  var SAVING_IMAGE = false;
  var INTERACTION_NONE = 0;
  var INTERACTION_DRAG = 1;
  var INTERACTION_ROTATE = 2;
  var INTERACTION_ZOOM = 3;
  var INTERACTION_OVERVIEW = 4;
  var INTERACTION_OVERVIEW_DRAG = 5;

  // TODO: Can we get rid of args parameter now that we have ProcessArguments method?
  // See the top of the file for description of args.
  function Viewer (parent) {
    var self = this;

    this.Parent = parent;
    parent.addClass('sa-viewer');

    this.Div = $('<div>')
            .appendTo(this.Parent)
            .css({'position': 'relative',
              'border-width': '0px',
              'width': '100%',
              'height': '100%',
              'box-sizing': 'border-box'})
            .addClass('sa-resize');
    this.Div.saOnResize(
            function () {
              self.UpdateSize();
            });

    // I am moving the eventually render feature into viewers.
    this.Drawing = false;
    this.RenderPending = false;
    this.Rotatable = true;

    this.HistoryFlag = false;
    this.MinPixelSize = 0.5;

    // Interaction state:
    // What to do for mouse move or mouse up.
    this.InteractionState = INTERACTION_NONE;
    // External callbacks
    this.InteractionListeners = [];
    // TODO: Get rid of this.  Remove bindings instead.
    // This is a hack to turn off interaction.
    // Sometime I need to clean up the events for viewers.
    this.InteractionEnabled = true;

    this.AnimateLast = null;
    this.AnimateDuration = 0.0;
    this.TranslateTarget = [0.0, 0.0];

    this.MainView = new SA.TileView(this.Div, false);
    // webgl for main view.
    this.MainView.OutlineColor = [0, 0, 0];
    this.MainView.Camera.ZRange = [0, 1];
    this.MainView.Camera.ComputeMatrix();

    this.Layers = [];

    if (!SAM.detectMobile() || SAM.MOBILE_DEVICE === 'iPad') {
      this.OverViewVisibility = true;
      this.OverViewScale = 0.02; // Experimenting with scroll
      this.OverViewport = [80, 20, 180, 180];
      this.OverViewDiv = $('<div>')
                .appendTo(this.Div);

      this.OverView = new SA.TileView(this.OverViewDiv);
      this.OverView.Camera.ZRange = [-1, 0];
      this.OverView.Camera.SetFocalPoint([13000.0, 11000.0]);
      this.OverView.Camera.SetHeight(22000.0);
      this.OverView.Camera.ComputeMatrix();

      // One must be true for the icon to be active (opaque).
      this.RotateIconHover = false;
      // I am not making this part of the InteractionState because
      // I want to make the overview its own widget.
      this.RotateIconDrag = false;

      this.RotateIcon =
                $('<img>')
                .appendTo(this.OverView.CanvasDiv)
                .attr('src', SA.ImagePathUrl + 'rotate.png')
                .addClass('sa-view-rotate')
                .mouseenter(function (e) { return self.RollEnter(e); })
                .mouseleave(function (e) { return self.RollLeave(e); })
                .mousedown(function (e) { return self.RollDown(e); })
                .attr('draggable', 'false')
                .on('dragstart', function () {
                  return false;
                });
      // Try to make the overview be on top of the rotate icon
      // It should receive events before the rotate icon.
      this.OverViewDiv.css({'z-index': '200'});
    }
    this.ZoomTarget = this.MainView.Camera.GetHeight();
    this.RollTarget = this.MainView.Camera.Roll;

    this.DoubleClickX = 0;
    this.DoubleClickY = 0;

    // For stack correlations.
    this.StackCorrelations = undefined;
    // This is only for drawing correlations.
    this.RecordIndex = 0; // Only used for drawing correlations.

    var can = this.MainView.CanvasDiv;
    // So we can programatically set the keyboard focus
    can.attr('tabindex', '1');
    can.on(
            'mousedown.viewer',
         function (event) {
           return self.HandleMouseDown(event);
         });
    can.on(
            'mousemove.viewer',
         function (event) {
           // So key events go the the right viewer.
           this.focus();
           // Firefox does not set which for mouse move events.
           SA.FirefoxWhich(event);
           return self.HandleMouseMove(event);
         });
        // We need to detect the mouse up even if it happens outside the canvas,
    $(document.body).on(
            'mouseup.viewer',
         function (event) {
           self.HandleMouseUp(event);
           return true;
         });
    can.on(
            'wheel.viewer',
            function (event) {
              return self.HandleMouseWheel(event.originalEvent);
            });

        // I am delaying getting event manager out of receiving touch events.
        // It has too many helper functions.
    can.on(
            'touchstart.viewer',
            function (event) {
              return self.HandleTouchStart(event.originalEvent);
            });
    can.on(
            'touchmove.viewer',
            function (event) {
              return self.HandleTouchMove(event.originalEvent);
            });
    can.on(
            'touchend.viewer',
            function (event) {
              self.HandleTouchEnd(event.originalEvent);
              return true;
            });

        // necesary to respond to keyevents.
    this.MainView.CanvasDiv.attr('tabindex', '1');
    can.on(
            'keydown.viewer',
         function (event) {
           // alert("keydown");
           return self.HandleKeyDown(event);
         });
    can.on(
            'keyup.viewer',
         function (event) {
           return self.HandleKeyUp(event);
         });

    // This did not work for double left click
    // Go back to my original way of handling this.
    // can.addEventListener("dblclick",
    //                    function (event){self.HandleDoubleClick(event);},
    //                    false);

    if (this.OverView) {
      can = this.OverView.CanvasDiv;
      can.on(
                'mousedown.viewer',
                function (e) {
                  return self.HandleOverViewMouseDown(e);
                });

      can.on(
                'mouseup.viewer',
             function (e) {
               return self.HandleOverViewMouseUp(e);
             });
      can.on(
                'mousemove.viewer',
             function (e) {
               return self.HandleOverViewMouseMove(e);
             });
      // I cannot get this to capture events.  The feature of resizing
      //    the overview with the mouse wheel is not important anyway.
      // can[0].addEventListener(
      //    function (e){return self.HandleOverViewMouseWheel(e);},
      //    "wheel",
      //    false);
    }

    this.CopyrightWrapper = $('<div>')
            .appendTo(this.MainView.CanvasDiv)
            .addClass('sa-view-copyright');
    if (SA.Session && SA.Session.sessid === '560b5127a7a1412195d13685') {
      this.Icon = $('<img>')
                .appendTo(this.MainView.CanvasDiv)
                .attr('src', 'http://static1.squarespace.com/static/5126bbb4e4b08c2e6d1cb6e4/t/54e66f05e4b0440df79a5729/1424387847915/')
                .prop('title', 'UC Davis')
                .css({'position': 'absolute',
                  'bottom': '80px',
                  'left': '7px',
                  'width': '128px',
                  'z-index': '4'});
    }
    if (SA.Session && SA.Session.sessid === '57504ba7a7a1411310dd2637') {
      this.Icon = $('<img>')
                .appendTo(this.MainView.CanvasDiv)
                .attr('src', 'https://slide-atlas.org/api/v2/sessions/53d9230fdd98b54fd71e8ed7/attachments/57518ce4a7a14113156b8166')
                .prop('title', 'Philips')
                .css({'position': 'absolute',
                  'bottom': '90px',
                  'left': '7px',
                  'width': '100px',
                  'z-index': '4'});
    }

    // notice this is not new AnnotationLayer();
    var annotationLayer1 = this.NewAnnotationLayer();
    // Some widgets need access to the viewer.  rectSet and segment/contour
    annotationLayer1.Viewer = this;
    this.annotationWidget1 =
      new SA.AnnotationWidget(annotationLayer1, this);
  }

  // Allow the viewer to receive keyboard events.
  Viewer.prototype.Focus = function () {
    var can = this.MainView.CanvasDiv;
    can.focus();
  };

  Viewer.prototype.SetRotatable = function (flag) {
    this.Rotatable = flag;
    if (flag) {
      this.RotateIcon.show();
    } else {
      this.RotateIcon.hide();
    }
  };

  // Try to remove all global references to this viewer.
  Viewer.prototype.Delete = function () {
    this.Div.remove();
    // Remove circular references too?
    // This will probably affect all viewers.
    $(document.body).off('mouseup.viewer');
    this.MainView.Delete();
    if (this.OverView) {
      this.OverView.Delete();
      delete this.OverView;
    }
    delete this.MainView;
    delete this.Parent;
    delete this.Div;
    delete this.InteractionListeners;
    delete this.RotateIcon;
    delete this.StackCorrelations;
    delete this.CopyrightWrapper;
  };

  // Layers have a Draw(masterView) method.
  Viewer.prototype.AddLayer = function (layer) {
    this.Layers.push(layer);
  };

  // Hack to get the annotation layer
  Viewer.prototype.GetAnnotationLayer = function () {
    for (var i = 0; i < this.Layers.length; ++i) {
      if (this.Layers[i] instanceof SAM.AnnotationLayer) {
        return this.Layers[i];
      }
    }

    return this.NewAnnotationLayer();
  };

    // Abstracting saViewer  for viewer and dualViewWidget.
    // Save viewer state in a note.
  Viewer.prototype.Record = function (note, viewIdx) {
    viewIdx = viewIdx || 0;
    note.ViewerRecords[viewIdx].CopyViewer(this);
  };

  // TODO: Make the annotation layer optional.
  // I am moving some of the saViewer code into this viewer object because
  // I am trying to abstract the single viewer used for the HTML presentation
  // note and the full dual view / stack note.
  // TODO: Make an alternative path that does not require a note.
  Viewer.prototype.ProcessArguments = function (args) {
    if (args.overview !== undefined) {
      this.SetOverViewVisibility(args.overview);
    }
    if (args.zoomWidget !== undefined) {
      this.SetZoomWidgetVisibility(args.zoomWidget);
    }
    if (args.drawWidget !== undefined) {
      this.SetAnnotationWidgetVisibility(args.drawWidget);
    }
    if (args.rotatable !== undefined) {
      this.SetRotatable(args.rotatable);
    }

    // The way I handle the viewer edit menu is messy.
    // TODO: Find a more elegant way to add tabs.
    // Maybe the way we handle the anntation tab shouodl be our pattern.
    if (args.menu !== undefined) {
      if (!this.Menu) {
        this.Menu = new SA.ViewEditMenu(this, null);
      }
      this.Menu.SetVisibility(args.menu);
    }

    if (args.tileSource) {
      args.note = SA.TileSourceToNote(args.tileSource);
    }

    if (args.note) {
      this.saNote = args.note;
      var index = this.saViewerIndex = args.viewerIndex || 0;
      this.SetViewerRecord(args.note.ViewerRecords[index]);

      this.Parent.attr('sa-note-id', args.note.Id || args.note.TempId);
      this.Parent.attr('sa-viewer-index', this.saViewerIndex);
    }
    if (args.hideCopyright !== undefined) {
      this.SetCopyrightVisibility(!args.hideCopyright);
    }
    if (args.interaction !== undefined) {
      this.SetInteractionEnabled(args.interaction);
    }
    this.UpdateSize();
  };

  // Which is better calling Note.Apply, or viewer.SetNote?  I think this
  // will  win.  The layer needs to have a load callback for vigilant threshold.
  Viewer.prototype.SetViewerRecord = function (viewerRecord, lockCamera) {
    // If a widget is active, then just inactivate it.
    // It would be nice to undo pencil strokes in the middle, but this feature will have to wait.
    if (this.ActiveWidget) {
      // Hackish way to deactivate.
      this.ActiveWidget.SetActive(false);
    }

    if (!lockCamera) {
      this.Reset();
      var cache = this.GetCache();
      if (!cache || viewerRecord.Image._id !== cache.Image._id) {
        var newCache = SA.FindCache(viewerRecord.Image);
        this.SetCache(newCache);
      }

      this.SetOverViewBounds(viewerRecord.OverviewBounds);

      if (viewerRecord.Camera !== undefined && viewerRecord.Transform === undefined) {
        var cameraRecord = viewerRecord.Camera;
        this.GetCamera().Load(cameraRecord);
        if (this.OverView) {
          this.OverView.Camera.Roll = cameraRecord.Roll;
          this.OverView.Camera.ComputeMatrix();
        }
        this.UpdateZoomGui();
        this.UpdateCamera();
      }
    } else {
      // Just get rid of the annotations.
      this.GetAnnotationLayer().Reset();
    }

    // TODO: Get rid of this hack.
    if (this.AnnotationWidget && viewerRecord.AnnotationVisibility !== undefined) {
      this.AnnotationWidget.SetVisibility(viewerRecord.AnnotationVisibility);
    }

    var annotationLayer = this.GetAnnotationLayer();
    if (annotationLayer) {
      annotationLayer.Reset();
      // What about the other layers?
      // Should we propagate the use of notes outside slide atlas?
      // Probably not.  Use loading and serializing piecemeal as necessary.
      if (viewerRecord.Annotations) {
        annotationLayer.LoadAnnotations(viewerRecord.Annotations);
      }
      // Load the annotations from the user note.
      if (viewerRecord.UserNote) {
        var annotations = viewerRecord.UserNote.ViewerRecords[0].Annotations;
        annotationLayer.LoadAnnotations(annotations);
      }
    }

    // fit the canvas to the div size.
    this.UpdateSize();
  };

  Viewer.prototype.SetNote = function (note, viewIdx) {
    if (!note || viewIdx < 0 || viewIdx >= note.ViewerRecords.length) {
      console.log('Cannot set viewer record of note');
      return;
    }
    this.SetViewerRecord(note.ViewerRecords[viewIdx]);
    this.saNote = note;
    this.saViewerIndex = viewIdx;
  };
  Viewer.prototype.SetNoteFromId = function (noteId, viewIdx) {
    var self = this;
    var note = SA.GetNoteFromId(noteId);
    if (!note) {
      note = new SA.Note();
      note.LoadViewId(
                noteId,
                function () {
                  self.SetNote(note, viewIdx);
                });
      return note;
    }
    this.SetNote(note, viewIdx);
    return note;
  };

  Viewer.prototype.SetOverViewVisibility = function (visible) {
    this.OverViewVisibility = visible;
    if (!this.OverViewDiv) { return; }
    if (visible) {
      this.OverViewDiv.show();
    } else {
      this.OverViewDiv.hide();
    }
  };

  Viewer.prototype.GetOverViewVisibility = function () {
    return this.OverViewVisibility;
  };

  Viewer.prototype.Hide = function () {
    this.MainView.CanvasDiv.hide();
    if (this.OverView) {
      this.OverView.CanvasDiv.hide();
    }
  };

  Viewer.prototype.Show = function () {
    this.MainView.CanvasDiv.show();
    if (this.OverView && this.OverViewVisibility) {
      this.OverView.CanvasDiv.show();
    }
  };

    // The interaction boolean argument will supress interaction events if false.
  Viewer.prototype.EventuallyRender = function (interaction) {
    if (!this.RenderPending) {
      this.RenderPending = true;
      var self = this;
      window.requestAnimationFrame(
                function () {
                  self.RenderPending = false;
                  self.Draw();
                  if (interaction) {
                        // Easiest place to make sure interaction events are triggered.
                    self.TriggerInteraction();
                  }
                });
    }
  };

    // These should be in an overview widget class.
  Viewer.prototype.RollEnter = function (e) {
    if (!this.Rotatable) { return; }
    this.RotateIconHover = true;
    this.RotateIcon.addClass('sa-active');
  };
  Viewer.prototype.RollLeave = function (e) {
    if (!this.Rotatable) { return; }
    this.RotateIconHover = false;
    if (!this.RotateIconDrag) {
      this.RotateIcon.removeClass('sa-active');
    }
  };
  Viewer.prototype.RollDown = function (e) {
    if (!this.OverView) { return; }
    if (!this.Rotatable) { return; }
    this.RotateIconDrag = true;
        // Find the center of the overview window.
    var w = this.OverView.CanvasDiv;
    var o = w.offset();
    var cx = o.left + (w.width() / 2);
    var cy = o.top + (w.height() / 2);
    this.RotateIconX = e.clientX - cx;
    this.RotateIconY = e.clientY - cy;

    return false;
  };
  Viewer.prototype.RollMove = function (e) {
    if (!this.OverView) { return; }
    if (!this.RotateIconDrag) { return; }
    if (!this.Rotatable) { return; }
    if (e.which !== 1) {
            // We must have missed the mouse up event.
      this.RotateIconDrag = false;
      return;
    }
        // Find the center of the overview window.
    var origin = this.MainView.CanvasDiv.offset();
        // center of rotation
    var cx = this.OverViewport[0] + (this.OverViewport[2] / 2);
    var cy = this.OverViewport[1] + (this.OverViewport[3] / 2);

    var x = (e.clientX - origin.left) - cx;
    var y = (e.clientY - origin.top) - cy;
    var c = x * this.RotateIconY - y * this.RotateIconX;
    var r = c / (x * x + y * y);

    this.MainView.Camera.Roll -= r;
    this.UpdateCamera();
    this.EventuallyRender(true);

    this.RotateIconX = x;
    this.RotateIconY = y;

    return false;
  };

    // onresize callback.  Canvas width and height and the camera need
    // to be synchronized with the canvas div.
  Viewer.prototype.UpdateSize = function () {
    if (!this.MainView) {
      return;
    }
    if (this.MainView.UpdateCanvasSize()) {
      this.EventuallyRender();
    }

    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer && layer.UpdateSize) {
        layer.UpdateSize();
      }
    }

    // I do not know the way the viewport is used to place
    // this overview.  It should be like other widgets
    // and be placed relative to the parent.
    if (this.OverView) {
      var width = this.MainView.GetWidth();
      var height = this.MainView.GetHeight();
      var area = width * height;
      var bounds = this.GetOverViewBounds();
      var aspect = (bounds[1] - bounds[0]) / (bounds[3] - bounds[2]);
      // size of overview
      var h = Math.sqrt(area * this.OverViewScale / aspect);
      var w = h * aspect;
      // Limit size
      if (h > height / 2) {
        h = height / 2;
        w = h * aspect;
        this.OverViewScale = w * h / area;
      }
      // center of overview
      var radius = Math.sqrt(h * h + w * w) / 2;
      // Construct the viewport.  Hack: got rid of viewport[0]
      // TODO: I really need to get rid of the viewport stuff
      this.OverViewport = [width - radius - w / 2,
        radius - h / 2,
        w, h];
      this.OverViewDiv.css({
        'left': this.OverViewport[0] + 'px',
        'width': this.OverViewport[2] + 'px',
        'top': this.OverViewport[1] + 'px',
        'height': this.OverViewport[3] + 'px'
      });
      this.OverView.UpdateCanvasSize();
    }
  };

  // TODO: Events are a pain because most are handled by parent.
  // Time to make the overview a real widget?
  Viewer.prototype.RollUp = function (e) {
    this.RotateIconDrag = false;
    if (!this.RotateIconHover) {
      this.RotateIcon.addClass('sa-active');
    }

    return false;
  };

  Viewer.prototype.GetMainCanvas = function () {
    return this.MainView.Canvas;
  };

    // A way to have a method called every time the camera changes.
    // Will be used for synchronizing viewers for stacks.
  Viewer.prototype.OnInteraction = function (callback) {
        // How should we remove listners?
        // Global clear for now.
    if (!callback) {
      this.InteractionListeners = [];
    } else {
      this.InteractionListeners.push(callback);
    }
  };

  Viewer.prototype.TriggerInteraction = function () {
    for (var i = 0; i < this.InteractionListeners.length; ++i) {
      var callback = this.InteractionListeners[i];
      callback();
    }
  };

  Viewer.prototype.GetDiv = function () {
    return this.MainView.CanvasDiv;
  };

  Viewer.prototype.InitializeZoomGui = function () {
        // Put the zoom bottons in a tab.
    this.ZoomTab = new SA.Tab(this.GetDiv(),
                               SA.ImagePathUrl + 'mag.png',
                               'zoomTab');
    this.ZoomTab.Div
            .css({'box-sizing': 'border-box',
              'position': 'absolute',
              'bottom': '0px',
              'right': '7px',
              'z-index': '200'})
            .prop('title', 'Zoom scroll');
    this.ZoomTab.Panel
            .addClass('sa-view-zoom-panel');

        // Put the magnification factor inside the magnify glass icon.
    this.ZoomDisplay = $('<div>')
            .appendTo(this.ZoomTab.Div)
            .addClass('sa-view-zoom-text')
            .html('');

        // Place the zoom in / out buttons.
        // Todo: Make the button become more opaque when pressed.
        // Associate with viewer (How???).
        // Place properly (div per viewer?) (viewer.SetViewport also places buttons).
    var self = this;

    this.ZoomDiv = $('<div>')
            .appendTo(this.ZoomTab.Panel)
            .addClass('sa-view-zoom-panel-div');
    this.ZoomInButton = $('<img>')
            .appendTo(this.ZoomDiv)
            .addClass('sa-view-zoom-button sa-zoom-in')
            .attr('type', 'image')
            .attr('src', SA.ImagePathUrl + 'zoomin2.png')
            .click(function () { self.AnimateZoom(0.5); })
            .attr('draggable', 'false')
            .on('dragstart', function () {
              return false;
            });

    this.ZoomOutButton = $('<img>').appendTo(this.ZoomDiv)
            .addClass('sa-view-zoom-button sa-zoom-out')
            .attr('type', 'image')
            .attr('src', SA.ImagePathUrl + 'zoomout2.png')
            .click(function () { self.AnimateZoom(2.0); })
            .attr('draggable', 'false')
            .on('dragstart', function () {
              return false;
            });

    this.ZoomInButton.addClass('sa-active');
    this.ZoomOutButton.addClass('sa-active');
  };

  Viewer.prototype.UpdateZoomGui = function () {
    if (!this.ZoomDisplay) { return; }
    var camHeight = this.GetCamera().GetHeight();
    var windowHeight = this.GetViewport()[3];
        // Assume image scanned at 40x
    var zoomValue = 40.0 * windowHeight / camHeight;
        // 2.5 and 1.25 are standard in the geometric series.
    if (zoomValue < 2) {
      zoomValue = zoomValue.toFixed(2);
    } else if (zoomValue < 4) {
      zoomValue = zoomValue.toFixed(1);
    } else {
      zoomValue = Math.round(zoomValue);
    }
    this.ZoomDisplay.html('x' + zoomValue);

        // I am looking for the best place to update this value.
        // Trying to fix a bug: Large scroll when wheel event occurs
        // first.
    this.ZoomTarget = camHeight;
  };

  Viewer.prototype.SaveImage = function (fileName) {
    this.MainView.Canvas[0].toBlob(function (blob) { saveAs(blob, fileName); }, 'image/png');
  };

    // Cancel the large image request before it finishes.
  Viewer.prototype.CancelLargeImage = function () {
        // This will abort the save blob that occurs after rendering.
    SA.ClearFinishedLoadingCallbacks();
        // We also need to stop the request for pending tiles.
    SA.ClearQueue();
        // Incase some of the queued tiles were for normal rendering.
    this.EventuallyRender(false);
  };

    // NOTE: Consider option for annotation layer to share a canvas with the
    // tile view.
    // Create a virtual viewer to save a very large image.
  Viewer.prototype.SaveLargeImage = function (fileName, width, height, stack,
                                               finishedCallback) {
    var self = this;
    var cache = this.GetCache();
    var cam = this.GetCamera();

        // Clone the main view.
    var view = new SA.TileView();
    view.SetCache(cache);
    view.Canvas.attr('width', width);
    view.Canvas.attr('height', height);
    view.SetViewport([0, 0, width, height]);
    var newCam = view.Camera;

    newCam.SetFocalPoint(cam.FocalPoint);
    newCam.Roll = cam.Roll;
    newCam.Height = cam.GetHeight();
    newCam.Width = cam.GetWidth();
    newCam.ViewportWidth = width;
    newCam.ViewportHeight = height;
    newCam.ComputeMatrix();

        // Load only the tiles we need.
    var tiles = cache.ChooseTiles(newCam, 0, []);
    for (var i = 0; i < tiles.length; ++i) {
      SA.LoadQueueAddTile(tiles[i]);
    }
    SA.LoadQueueUpdate();

        // this.CancelLargeImage = false;
    SA.AddFinishedLoadingCallback(
            function () {
              self.SaveLargeImage2(view, fileName,
                                              width, height, stack,
                                              finishedCallback);
            }
        );
  };

  Viewer.prototype.SaveLargeImage2 = function (view, fileName,
                                                width, height, stack,
                                                finishedCallback) {
    var sectionFileName = fileName;
    var note;
    if (stack) {
      note = SA.display.GetNote();
      var idx = fileName.indexOf('.');
      if (idx < 0) {
        sectionFileName = fileName + SA.ZERO_PAD(note.StartIndex, 4) + '.png';
      } else {
        sectionFileName = fileName.substring(0, idx) +
                    SA.ZERO_PAD(note.StartIndex, 4) +
                    fileName.substring(idx, fileName.length);
      }
    }
    console.log(sectionFileName + ' ' + SA.LoadQueue.length + ' ' + SA.LoadingCount);

    if (!view.Draw()) {
      console.log('Sanity check failed. Not all tiles were available.');
    }
    this.MainView.DrawShapes();

    for (var i = 0; i < this.Layers.length; ++i) {
      this.Layers[i].Draw(view);
    }

    console.log(JSON.stringify(this.GetCamera().Serialize()));

    view.Canvas[0].toBlob(function (blob) { saveAs(blob, sectionFileName); }, 'image/png');
    if (stack) {
      note = SA.display.GetNote();
      if (note.StartIndex < note.ViewerRecords.length - 1) {
        SA.display.NavigationWidget.NextNote();
        var self = this;
        setTimeout(function () {
          self.SaveLargeImage(fileName, width, height, stack,
                                        finishedCallback);
        }, 1000);
        return;
      }
    }

    finishedCallback();
  };

  // This method waits until all tiles are loaded before saving.
  Viewer.prototype.EventuallySaveImage = function (fileName, finishedCallback) {
    var self = this;
    SA.AddFinishedLoadingCallback(
            function () {
              self.SaveImage(fileName);
              if (finishedCallback) {
                finishedCallback();
              }
            }
        );
    this.EventuallyRender(false);
  };

    // Not used anymore.  Incorpoarated in SaveLargeImage
    // delete these.
    // Save a bunch of stack images ----
  Viewer.prototype.SaveStackImages = function (fileNameRoot) {
    var self = this;
    SA.AddFinishedLoadingCallback(
            function () {
              self.SaveStackImage(fileNameRoot);
            }
        );
    this.EventuallyRender(false);
  };

  Viewer.prototype.SaveStackImage = function (fileNameRoot) {
    var self = this;
    var note = SA.display.GetNote();
    var fileName = fileNameRoot + SA.ZERO_PAD(note.StartIndex, 4);
    console.log(JSON.stringify(this.GetCamera().Serialize()));
    this.SaveImage(fileName);
    if (note.StartIndex < note.ViewerRecords.length - 1) {
      SA.display.NavigationWidget.NextNote();
      SA.AddFinishedLoadingCallback(
                function () {
                  self.SaveStackImage(fileNameRoot);
                }
            );
      this.EventuallyRender(false);
    }
  };
    // -----

  Viewer.prototype.SetOverViewBounds = function (bounds) {
    this.OverViewBounds = bounds;
    if (this.OverView) {
            // With the rotating overview, the overview camera
            // never changes. Maybe this should be set in
            // "UpdateCamera".
      this.OverView.Camera.SetHeight(bounds[3] - bounds[2]);
      this.OverView.Camera.SetFocalPoint([0.5 * (bounds[0] + bounds[1]),
        0.5 * (bounds[2] + bounds[3])]);
      this.OverView.Camera.ComputeMatrix();
    }
  };

  Viewer.prototype.GetOverViewBounds = function () {
    if (this.OverViewBounds) {
      return this.OverViewBounds;
    }
    var cache = this.GetCache();
    if (cache && cache.Image) {
      if (cache.Image.bounds) {
        return cache.Image.bounds;
      }
      if (cache.Image.dimensions) {
        var dims = cache.Image.dimensions;
        return [0, dims[0], 0, dims[1]];
      }
    }
        // Depreciated code.
    if (this.OverView) {
      var cam = this.OverView.Camera;
      var halfHeight = cam.GetHeight() / 2;
      var halfWidth = cam.GetWidth() / 2;
      this.OverViewBounds = [cam.FocalPoint[0] - halfWidth,
        cam.FocalPoint[0] + halfWidth,
        cam.FocalPoint[1] - halfHeight,
        cam.FocalPoint[1] + halfHeight];
      return this.OverViewBounds;
    }
        // This method is called once too soon.  There is no image, and mobile devices have no overview.
    return [0, 10000, 0, 10000];
  };

  Viewer.prototype.SetSection = function (section) {
    if (section === null) {
      return;
    }
    // this.MainView.Section = section;
    // if (this.OverView) {
    //   this.OverView.Section = section;
    // }
    // this.EventuallyRender(true);
    this.SetCache(section.GetCache(0));
  };

    // Change the source / cache after a viewer has been created.
  Viewer.prototype.SetCache = function (cache) {
    if (cache && cache.Image) {
      if (cache.Image.bounds) {
        this.SetOverViewBounds(cache.Image.bounds);
      }

      if (cache.Image.copyright === undefined) {
        cache.Image.copyright = 'Copyright 2017. All Rights Reserved.';
      }
      this.CopyrightWrapper
                .html(cache.Image.copyright);
    }

    this.MainView.SetCache(cache);
    if (this.OverView) {
      this.OverView.SetCache(cache);
      if (cache) {
        var bds = cache.GetBounds();
        if (bds) {
          this.OverView.Camera.SetFocalPoint([(bds[0] + bds[1]) / 2,
            (bds[2] + bds[3]) / 2]);
          var height = (bds[3] - bds[2]);
                    // See if the view is constrained by the width.
          var height2 = (bds[1] - bds[0]) * this.OverView.Viewport[3] / this.OverView.Viewport[2];
          if (height2 > height) {
            height = height2;
          }
          this.OverView.Camera.SetHeight(height);
          this.OverView.Camera.ComputeMatrix();
        }
      }
    }
        // Change the overview to fit the new image dimensions.
    this.UpdateSize();
  };

  Viewer.prototype.GetCache = function () {
    return this.MainView.GetCache();
  };

  // ORIGIN SEEMS TO BE BOTTOM LEFT !!!
  // I intend this method to get called when the window resizes.
  // TODO: Redo all this overview viewport junk.
  // viewport: [left, top, width, height]
  // When I remove this function, move the logic to UpdateSize().
  Viewer.prototype.SetViewport = function (viewport) {
    // TODO: Get rid of this positioning hack.
    // Caller should be positioning the parent.
    // The whole "viewport" concept needs to be eliminated.
    // this.MainView.SetViewport(viewport, this.Parent);
    // this.MainView.Camera.ComputeMatrix();

    // I do not know the way the viewport is used to place
    // this overview.  It should be like other widgets
    // and be placed relative to the parent.
    if (this.OverView) {
      var area = viewport[2] * viewport[3];
      var bounds = this.GetOverViewBounds();
      var aspect = (bounds[1] - bounds[0]) / (bounds[3] - bounds[2]);
      // size of overview
      var h = Math.sqrt(area * this.OverViewScale / aspect);
      var w = h * aspect;
      // Limit size
      if (h > viewport[3] / 2) {
        h = viewport[3] / 2;
        w = h * aspect;
        this.OverViewScale = w * h / area;
      }
      // center of overview
      var radius = Math.sqrt(h * h + w * w) / 2;
      // Construct the viewport.  Hack: got rid of viewport[0]
      // TODO: I really need to get rid of the viewport stuff
      this.OverViewport = [viewport[2] - radius - w / 2,
        viewport[1] + radius - h / 2,
        w, h];

      this.OverViewDiv.css({
        'left': this.OverViewport[0] + 'px',
        'width': this.OverViewport[2] + 'px',
        'top': this.OverViewport[1] + 'px',
        'height': this.OverViewport[3] + 'px'
      });
      this.OverView.UpdateCanvasSize();
    }
  };

  Viewer.prototype.GetViewport = function () {
    return this.MainView.Viewport;
  };

  // To fix a bug in the perk and elmer uploader.
  Viewer.prototype.ToggleMirror = function () {
    this.MainView.Camera.Mirror = !this.MainView.Camera.Mirror;
    if (this.OverView) {
      this.OverView.Camera.Mirror = !this.OverView.Camera.Mirror;
    }
  };

    // Same as set camera but use animation
  Viewer.prototype.AnimateCamera = function (center, rotation, height) {
    this.ZoomTarget = height;
        // Compute traslate target to keep position in the same place.
    this.TranslateTarget[0] = center[0];
    this.TranslateTarget[1] = center[1];
    this.RollTarget = rotation;

    this.AnimateLast = new Date().getTime();
    this.AnimateDuration = 200.0; // hard code 200 milliseconds
    this.EventuallyRender(true);
  };

    // This sets the overview camera from the main view camera.
    // The user can change the mainview camera and then call this method.
  Viewer.prototype.UpdateCamera = function () {
    var cam = this.MainView.Camera;
    this.ZoomTarget = cam.Height;

    this.TranslateTarget[0] = cam.FocalPoint[0];
    this.TranslateTarget[1] = cam.FocalPoint[1];
    this.RollTarget = cam.Roll;
    if (this.OverView) {
            // this.OverView.Camera.Roll = cam.Roll;
            // this.OverView.Camera.ComputeMatrix();
      this.OverView.CanvasDiv.css({'transform': 'rotate(' + cam.Roll + 'rad'});
      this.OverView.Camera.Roll = 0;
      this.OverView.Camera.ComputeMatrix();
    }

    this.MainView.Camera.ComputeMatrix();
    this.UpdateZoomGui();
  };

    // This is used to set the default camera so the complexities
    // of the target and overview are hidden.
  Viewer.prototype.SetCamera = function (center, rotation, height) {
    this.MainView.Camera.SetHeight(height);
    this.MainView.Camera.SetFocalPoint([center[0], center[1]]);
    this.MainView.Camera.Roll = rotation * 3.14159265359 / 180.0;

    this.UpdateCamera();
    this.EventuallyRender(true);
  };

  Viewer.prototype.GetCamera = function () {
    return this.MainView.Camera;
  };

    // I could merge zoom methods if position defaulted to focal point.
  Viewer.prototype.AnimateZoomTo = function (factor, position) {
    if (this.AnimateDuration > 0.0) {
            // Odd effect with multiple fast zoom clicks.  Center shifted.
      return;
    }

    SA.StackCursorFlag = false;

    this.ZoomTarget = this.MainView.Camera.GetHeight() * factor;
    if (this.ZoomTarget < 0.9 / (1 << 5)) {
      this.ZoomTarget = 0.9 / (1 << 5);
    }

        // Lets restrict discrete zoom values to be standard values.
    var windowHeight = this.GetViewport()[3];
    var tmp = Math.round(Math.log(32.0 * windowHeight / this.ZoomTarget) /
                             Math.log(2));
    this.ZoomTarget = 32.0 * windowHeight / Math.pow(2, tmp);

    factor = this.ZoomTarget / this.MainView.Camera.GetHeight(); // Actual factor after limit.

        // Compute translate target to keep position in the same place.
    this.TranslateTarget[0] = position[0] -
            factor * (position[0] - this.MainView.Camera.FocalPoint[0]);
    this.TranslateTarget[1] = position[1] -
            factor * (position[1] - this.MainView.Camera.FocalPoint[1]);

    this.RollTarget = this.MainView.Camera.Roll;

    this.AnimateLast = new Date().getTime();
    this.AnimateDuration = 200.0; // hard code 200 milliseconds
    this.EventuallyRender(true);
  };

  Viewer.prototype.AnimateZoom = function (factor) {
        // I cannot get the canvas from processing this event too.
        // Issue with double click. Hack to stop double click from firing.
    this.MouseUpTime -= 1000.0;

    if (this.AnimateDuration > 0.0) {
      return;
    }

    var focalPoint = this.GetCamera().GetFocalPoint();
    this.AnimateZoomTo(factor, focalPoint);
  };

  Viewer.prototype.AnimateTranslate = function (dx, dy) {
    this.TranslateTarget[0] = this.MainView.Camera.FocalPoint[0] + dx;
    this.TranslateTarget[1] = this.MainView.Camera.FocalPoint[1] + dy;

    this.ZoomTarget = this.MainView.Camera.GetHeight();
    this.RollTarget = this.MainView.Camera.Roll;

    this.AnimateLast = new Date().getTime();
    this.AnimateDuration = 200.0; // hard code 200 milliseconds
    this.EventuallyRender(true);
  };

  Viewer.prototype.AnimateRoll = function (dRoll) {
    dRoll *= Math.PI / 180.0;
    this.RollTarget = this.MainView.Camera.Roll + dRoll;

    this.ZoomTarget = this.MainView.Camera.GetHeight();
    this.TranslateTarget[0] = this.MainView.Camera.FocalPoint[0];
    this.TranslateTarget[1] = this.MainView.Camera.FocalPoint[1];

    this.AnimateLast = new Date().getTime();
    this.AnimateDuration = 200.0; // hard code 200 milliseconds
    this.EventuallyRender(true);
  };

  Viewer.prototype.AnimateTransform = function (dx, dy, dRoll) {
    this.TranslateTarget[0] = this.MainView.Camera.FocalPoint[0] + dx;
    this.TranslateTarget[1] = this.MainView.Camera.FocalPoint[1] + dy;

    this.RollTarget = this.MainView.Camera.Roll + dRoll;

    this.ZoomTarget = this.MainView.Camera.GetHeight();

    this.AnimateLast = new Date().getTime();
    this.AnimateDuration = 200.0; // hard code 200 milliseconds
    this.EventuallyRender(true);
  };

  Viewer.prototype.DegToRad = function (degrees) {
    return degrees * Math.PI / 180;
  };

  Viewer.prototype.Draw = function () {
    if (SA && SA.RootNote && SA.RootNote.WaterMark) {
      SA.WaterMark = true;
    } else {
      SA.WaterMark = false;
    }

    // I do not think this is actually necessary.
    // I was worried about threads, but javascript does not work that way.
    if (this.Drawing) { return; }
    this.Drawing = true;

    // This just changes the camera based on the current time.
    this.Animate();

    // console.time("ViewerDraw");

    // connectome
    if (!this.MainView || !this.MainView.Section) {
      return;
    }

    // Should the camera have the viewport in them?
    // The do not currently hav a viewport.

    // If we are still waiting for tiles to load, schedule another render.
    // This works fine, but results in many renders while waiting.
    // TODO: Consider having the tile load callback scheduling the next render.
    if (!this.MainView.Draw()) {
      this.EventuallyRender();
    }

    for (var i = 0; i < this.Layers.length; ++i) {
      this.Layers[i].Draw(this.MainView);
    }

    // This is not used anymore
    // However, I am thinking of resurecting it.  With many widgets,
    // drawing becomes slow.
    this.MainView.DrawShapes();
    if (this.OverView) {
      this.OverView.Draw();
      this.OverView.DrawOutline(true);
    }

    // Draw a rectangle in the overview representing the camera's view.
    if (this.OverView) {
      this.MainView.Camera.Draw(this.OverView);
      if (this.HistoryFlag) {
        this.OverView.DrawHistory(this.MainView.Viewport[3]);
      }
    }

    // TODO: Drawing correlations should not be embedded in a single
    // viewer. Maybe dualViewWidget or a new stack object should handle it.

    // I am using shift for stack interaction.
    // Turn on the focal point when shift is pressed.
    if (SA.StackCursorFlag && SA.Edit) {
      this.MainView.DrawFocalPoint();
      if (this.StackCorrelations) {
        this.MainView.DrawCorrelations(this.StackCorrelations, this.RecordIndex);
      }
    }

    // Here to trigger SA.FinishedLoadingCallbacks
    SA.LoadQueueUpdate();
    // console.timeEnd("ViewerDraw");
    this.Drawing = false;
  };

    // Makes the viewer clean to setup a new slide...
  Viewer.prototype.Reset = function () {
    this.MomentumX = 0.0;
    this.MomentumY = 0.0;
    this.MomentumRoll = 0.0;
    this.MomentumScale = 0.0;
    if (this.MomentumTimerId) {
      window.cancelAnimationFrame(this.MomentumTimerId);
      this.MomentumTimerId = 0;
    }

        // Keep further touch moves from having any impact.
    this.StartTouchTime = 0;

    this.SetCache(null);
    this.MainView.ShapeList = [];

    for (var i = 0; i < this.Layers.length; ++i) {
      if (this.Layers[i].Reset) {
        this.Layers[i].Reset();
      }
    }
  };

    // A list of shapes to render in the viewer
  Viewer.prototype.AddShape = function (shape) {
    this.MainView.AddShape(shape);
  };

  Viewer.prototype.Animate = function () {
    var roll;
    if (this.AnimateDuration <= 0.0) {
      return;
    }
    var timeNow = new Date().getTime();
    if (timeNow >= (this.AnimateLast + this.AnimateDuration)) {
      this.AnimateDuration = 0;
            // We have past the target. Just set the target values.
      this.MainView.Camera.SetHeight(this.ZoomTarget);
      this.MainView.Camera.Roll = this.RollTarget;
      this.MainView.Camera.SetFocalPoint([this.TranslateTarget[0],
        this.TranslateTarget[1]]);
      this.ConstrainCamera();
      if (this.OverView) {
                // this.OverView.Camera.Roll = this.RollTarget;
        roll = this.RollTarget;
        this.OverView.CanvasDiv.css({'transform': 'rotate(' + roll + 'rad'});
        this.OverView.Camera.Roll = 0;
        this.OverView.Camera.ComputeMatrix();
      }
      this.UpdateZoomGui();
      // Save the state when the animation is finished.
      if (SA.RECORDER_WIDGET) {
        SA.RECORDER_WIDGET.RecordState();
      }
    } else {
      // Interpolate
      var currentHeight = this.MainView.Camera.GetHeight();
      var currentCenter = this.MainView.Camera.GetFocalPoint();
      var currentRoll = this.MainView.Camera.Roll;

      this.MainView.Camera.SetHeight(
                currentHeight + (this.ZoomTarget - currentHeight) *
                    (timeNow - this.AnimateLast) / this.AnimateDuration);
      this.MainView.Camera.Roll =
                currentRoll + (this.RollTarget - currentRoll) *
                (timeNow - this.AnimateLast) / this.AnimateDuration;
      this.MainView.Camera.SetFocalPoint(
        [currentCenter[0] + (this.TranslateTarget[0] - currentCenter[0]) *
                 (timeNow - this.AnimateLast) / this.AnimateDuration,
          currentCenter[1] + (this.TranslateTarget[1] - currentCenter[1]) *
                 (timeNow - this.AnimateLast) / this.AnimateDuration]);
      this.ConstrainCamera();
      if (this.OverView) {
        // this.OverView.Camera.Roll = this.MainView.Camera.Roll;
        roll = this.MainView.Camera.Roll;
        this.OverView.CanvasDiv.css({'transform': 'rotate(' + roll + 'rad'});
        this.OverView.Camera.Roll = 0;
        this.OverView.Camera.ComputeMatrix();
      }
      this.AnimateDuration -= (timeNow - this.AnimateLast);
      // We are not finished yet.
      // Schedule another render
      this.EventuallyRender(true);
    }
    this.MainView.Camera.ComputeMatrix();
    if (this.OverView) {
      this.OverView.Camera.ComputeMatrix();
    }
    this.AnimateLast = timeNow;
    // Synchronize cameras is necessary
  };

  Viewer.prototype.OverViewPlaceCamera = function (x, y) {
    if (!this.OverView) {
      return;
    }
    // Compute focal point from inverse overview camera.
    x = x / this.OverView.Viewport[2];
    y = y / this.OverView.Viewport[3];
    x = (x * 2.0 - 1.0) * this.OverView.Camera.Matrix[15];
    y = (1.0 - y * 2.0) * this.OverView.Camera.Matrix[15];
    var m = this.OverView.Camera.Matrix;
    var det = m[0] * m[5] - m[1] * m[4];
    var xNew = (x * m[5] - y * m[4] + m[4] * m[13] - m[5] * m[12]) / det;
    var yNew = (y * m[0] - x * m[1] - m[0] * m[13] + m[1] * m[12]) / det;

    // Animate to get rid of jerky panning (overview to low resolution).
    this.TranslateTarget[0] = xNew;
    this.TranslateTarget[1] = yNew;
    this.AnimateLast = new Date().getTime();
    this.AnimateDuration = 100.0;
    this.EventuallyRender(true);
  };

  Viewer.prototype.SetInteractionEnabled = function (enabled) {
    this.InteractionEnabled = enabled;
  };
  Viewer.prototype.EnableInteraction = function () {
    this.InteractionEnabled = true;
  };
  Viewer.prototype.DisableInteraction = function () {
    this.InteractionEnabled = false;
  };

    // Used to be in EventManager.
    // TODO: Evaluate and cleanup.
  Viewer.prototype.RecordMouseDown = function (event) {
        // Evaluate where LastMouseX / Y are used.
    this.LastMouseX = this.MouseX || 0;
    this.LastMouseY = this.MouseY || 0;
    this.LastMouseTime = this.MouseTime || 0;
    this.SetMousePositionFromEvent(event);

        // TODO:  Formalize a call back to make GUI disappear when
        // navigation starts.  I think I did this already but have not
        // converted this code yet.
        // Get rid of the favorites and the link divs if they are visible
    if (SA.LinkDiv && SA.LinkDiv.is(':visible')) {
      SA.LinkDiv.fadeOut();
    }
    if (typeof SA.FAVORITES_WIDGET !== 'undefined' &&
           SA.FAVORITES_WIDGET.hidden === false) {
      SA.FAVORITES_WIDGET.ShowHideFavorites();
    }

    var date = new Date();
    var dTime = date.getTime() - this.MouseUpTime;
    if (dTime < 200.0) { // 200 milliseconds
      this.DoubleClick = true;
    }

        // this.TriggerStartInteraction();
  };
    // Used to be in EventManager.
    // TODO: Evaluate and cleanup.
  Viewer.prototype.SetMousePositionFromEvent = function (event) {
    if (event.offsetX && event.offsetY) {
      this.MouseX = event.offsetX;
      this.MouseY = event.offsetY;
      this.MouseTime = (new Date()).getTime();
    } else if (event.layerX && event.layerY) {
      this.MouseX = event.layerX;
      this.MouseY = event.layerY;
      this.MouseTime = (new Date()).getTime();
      event.offsetX = event.layerX;
      event.offsetY = event.layerY;
    }
  };
  Viewer.prototype.RecordMouseMove = function (event) {
    this.LastMouseX = this.MouseX;
    this.LastMouseY = this.MouseY;
    this.LastMouseTime = this.MouseTime;
    this.SetMousePositionFromEvent(event);
    this.MouseDeltaX = this.MouseX - this.LastMouseX;
    this.MouseDeltaY = this.MouseY - this.LastMouseY;
    this.MouseDeltaTime = this.MouseTime - this.LastMouseTime;
    return this.MouseDeltaX !== 0 || this.MouseDeltaY !== 0;
  };
  Viewer.prototype.RecordMouseUp = function (event) {
    this.SetMousePositionFromEvent(event);
    this.MouseDown = false;

        // Record time so we can detect double click.
    var date = new Date();
    this.MouseUpTime = date.getTime();
    this.DoubleClick = false;
  };

  // Save the previous touches and record the new
  // touch locations in viewport coordinates.
  Viewer.prototype.HandleTouch = function (e, startFlag) {
    var date = new Date();
    var t = date.getTime();
    // I have had trouble on the iPad with 0 delta times.
    // Lets see how it behaves with fewer events.
    // It was a bug in iPad4 Javascript.
    // This throttle is not necessary.
    if (t - this.Time < 20 && !startFlag) { return false; }

    this.LastTime = this.Time;
    this.Time = t;

    if (!e) {
      e = event;
    }

    // Still used on mobile devices?
    this.LastTouches = this.Touches;
    this.Touches = [];
    for (var i = 0; i < e.targetTouches.length; ++i) {
      var offset = this.MainView.Canvas.offset();
      var x = e.targetTouches[i].pageX - offset.left;
      var y = e.targetTouches[i].pageY - offset.top;
      this.Touches.push([x, y]);
    }

    this.LastMouseX = this.MouseX;
    this.LastMouseY = this.MouseY;

    // Compute the touch average.
    var numTouches = this.Touches.length;
    this.MouseX = this.MouseY = 0.0;
    for (i = 0; i < numTouches; ++i) {
      this.MouseX += this.Touches[i][0];
      this.MouseY += this.Touches[i][1];
    }
    this.MouseX = this.MouseX / numTouches;
    this.MouseY = this.MouseY / numTouches;

    // Hack because we are moving away from using the event manager
    // Mouse interaction are already independent...
    this.offsetX = this.MouseX;
    this.offsetY = this.MouseY;

    return true;
  };

  Viewer.prototype.HandleTouchStart = function (event) {
    if (!this.InteractionEnabled) { return true; }

    // Stuff from event manager
    this.HandleTouch(event, true);
    this.StartTouchTime = this.Time;

    // Let the annotation layers have first dibs on processing the event.
    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleTouchStart && !layer.HandleTouchStart(event)) {
        return false;
      }
    }

    SA.TriggerStartInteraction();

    this.MomentumX = 0.0;
    this.MomentumY = 0.0;
    this.MomentumRoll = 0.0;
    this.MomentumScale = 0.0;
    if (this.MomentumTimerId) {
      window.cancelAnimationFrame(this.MomentumTimerId);
      this.MomentumTimerId = 0;
    }

        // Four finger grab resets the view.
    if (this.Touches.length >= 4) {
      var cam = this.GetCamera();
      var bds = this.MainView.Section.GetBounds();
      cam.SetFocalPoint([(bds[0] + bds[1]) * 0.5, (bds[2] + bds[3]) * 0.5]);
      cam.Roll = 0.0;
      cam.SetHeight(bds[3] - bds[2]);
      cam.ComputeMatrix();
      this.EventuallyRender();
            // Return value hides navigation widget
      return true;
    }

    return false;
  };

  Viewer.prototype.HandleTouchMove = function (e) {
        // Case where sweep caused nextNote.
        // Short circuit interaction.
    if (this.StartTouchTime === 0) { return false; }

        // Put a throttle on events
    if (!this.HandleTouch(e, false)) { return; }

    if (SA.display && SA.display.NavigationWidget &&
        SA.display.NavigationWidget.Visibility) {
      // No slide interaction with the interface up.
      // I had bad interaction with events going to browser.
      SA.display.NavigationWidget.ToggleVisibility();
    }

    if (typeof (SA.MOBILE_ANNOTATION_WIDGET) !== 'undefined' &&
            SA.MOBILE_ANNOTATION_WIDGET.Visibility) {
      // No slide interaction with the interface up.
      // I had bad interaction with events going to browser.
      SA.MOBILE_ANNOTATION_WIDGET.ToggleVisibility();
    }

    // Let the annotation layers have first dibs on processing the event.
    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleTouchMove && !layer.HandleTouchMove(event)) {
        return false;
      }
    }

    // detect sweep
    // Cross the screen in 1/2 second.
    var viewerWidth = this.MainView.CanvasDiv.width();
    var dxdt = 1000 * (this.MouseX - this.LastMouseX) / ((this.Time - this.LastTime) * viewerWidth);
        // console.log(dxdt);
    if (SA.display && SA.display.NavigationWidget) {
      if (dxdt > 4.0) {
        SA.display.NavigationWidget.PreviousNote();
        return false;
      }
      if (dxdt < -4.0) {
        SA.display.NavigationWidget.NextNote();
        return false;
      }
    }

    if (this.Touches.length === 1) {
      this.HandleTouchPan(this);
    } else if (this.Touches.length === 2) {
      this.HandleTouchPinch(this);
    } else if (this.Rotatable && this.Touches.length === 3) {
      this.HandleTouchRotate(this);
    }
  };

  // Only one touch
  Viewer.prototype.HandleTouchPan = function (event) {
    if (!this.InteractionEnabled) { return true; }
    if (this.Touches.length !== 1 || this.LastTouches.length !== 1) {
      // Sanity check.
      return;
    }

    // Let the annotation layers have first dibs on processing the event.
    // TODO Either forward primary or secondary events.
    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleTouchPan && !layer.HandleTouchPan(event)) {
        return false;
      }
    }

    // I see an odd intermittent camera matrix problem
    // on the iPad that looks like a thread safety issue.
    if (this.MomentumTimerId) {
      window.cancelAnimationFrame(this.MomentumTimerId);
      this.MomentumTimerId = 0;
    }

    // Convert to world by inverting the camera matrix.
    // I could simplify and just process the vector.
    var w0 = this.ConvertPointViewerToWorld(this.LastMouseX, this.LastMouseY);
    var w1 = this.ConvertPointViewerToWorld(this.MouseX, this.MouseY);

    // This is the new focal point.
    var dx = w1[0] - w0[0];
    var dy = w1[1] - w0[1];
    var dt = event.Time - this.LastTime;

    // Remember the last motion to implement momentum.
    var momentumX = dx / dt;
    var momentumY = dy / dt;

        // Integrate momentum over a time period to avoid a fast event
        // dominating behavior.
    var k = Math.min(this.Time - this.LastTime, 250) / 250;
    this.MomentumX += (momentumX - this.MomentumX) * k;
    this.MomentumY += (momentumY - this.MomentumY) * k;
    this.MomentumRoll = 0.0;
    this.MomentumScale = 0.0;

    var cam = this.GetCamera();
    cam.Translate(-dx, -dy, 0);
    cam.ComputeMatrix();
    this.EventuallyRender(true);
  };

  Viewer.prototype.HandleTouchRotate = function (event) {
    if (!this.InteractionEnabled) { return true; }
    if (!this.Rotatable) { return true; }
    var numTouches = this.Touches.length;
    if (this.LastTouches.length !== numTouches || numTouches !== 3) {
            // Sanity check.
      return;
    }

        // I see an odd intermittent camera matrix problem
        // on the iPad that looks like a thread safety issue.
    if (this.MomentumTimerId) {
      window.cancelAnimationFrame(this.MomentumTimerId);
      this.MomentumTimerId = 0;
    }

    var w0 = this.ConvertPointViewerToWorld(this.LastMouseX, this.LastMouseY);
    var w1 = this.ConvertPointViewerToWorld(this.MouseX, this.MouseY);
    var dt = event.Time - this.LastTime;

        // Compute rotation.
        // Consider weighting rotation by vector length to avoid over contribution of short vectors.
        // We could also take the maximum.
    var x;
    var y;
    var a = 0;
    for (var i = 0; i < numTouches; ++i) {
      x = this.LastTouches[i][0] - this.LastMouseX;
      y = this.LastTouches[i][1] - this.LastMouseY;
      var a1 = Math.atan2(y, x);
      x = this.Touches[i][0] - this.MouseX;
      y = this.Touches[i][1] - this.MouseY;
      a1 = a1 - Math.atan2(y, x);
      if (a1 > Math.PI) { a1 = a1 - (2 * Math.PI); }
      if (a1 < -Math.PI) { a1 = a1 + (2 * Math.PI); }
      a += a1;
    }
    a = a / numTouches;

        // rotation and scale are around the mid point .....
        // we need to compute focal point height and roll (not just a matrix).
        // Focal point is the only difficult item.
    var cam = this.GetCamera();
    w0[0] = cam.FocalPoint[0] - w1[0];
    w0[1] = cam.FocalPoint[1] - w1[1];
    var c = Math.cos(a);
    var s = Math.sin(a);
        // This is the new focal point.
    x = w1[0] + (w0[0] * c - w0[1] * s);
    y = w1[1] + (w0[0] * s + w0[1] * c);

        // Remember the last motion to implement momentum.
    var momentumRoll = a / dt;

    this.MomentumX = 0.0;
    this.MomentumY = 0.0;
    this.MomentumRoll = (this.MomentumRoll + momentumRoll) * 0.5;
    this.MomentumScale = 0.0;

    cam.Roll = cam.Roll - a;
    cam.ComputeMatrix();
    if (this.OverView) {
      var cam2 = this.OverView.Camera;
      cam2.Roll = cam.Roll;
      cam2.ComputeMatrix();
    }
    this.EventuallyRender(true);
  };

  Viewer.prototype.HandleTouchPinch = function (event) {
    if (!this.InteractionEnabled) { return true; }
    var numTouches = this.Touches.length;
    if (this.LastTouches.length !== numTouches || numTouches !== 2) {
            // Sanity check.
      return;
    }

        // I see an odd intermittent camera matrix problem
        // on the iPad that looks like a thread safety issue.
    if (this.MomentumTimerId) {
      window.cancelAnimationFrame(this.MomentumTimerId);
      this.MomentumTimerId = 0;
    }

    var w0 = this.ConvertPointViewerToWorld(this.LastMouseX, this.LastMouseY);
    var w1 = this.ConvertPointViewerToWorld(this.MouseX, this.MouseY);
    var dt = event.Time - this.LastTime;
        // iPad / iPhone must have low precision time
    if (dt === 0) {
      return;
    }

        // Compute scale.
        // Consider weighting rotation by vector length to avoid over contribution of short vectors.
        // We could also take max.
        // This should rarely be an issue and could only happen with 3 or more touches.
    var scale = 1;
    var s0 = 0;
    var s1 = 0;
    var x, y;
    for (var i = 0; i < numTouches; ++i) {
      x = this.LastTouches[i][0] - this.LastMouseX;
      y = this.LastTouches[i][1] - this.LastMouseY;
      s0 += Math.sqrt(x * x + y * y);
      x = this.Touches[i][0] - this.MouseX;
      y = this.Touches[i][1] - this.MouseY;
      s1 += Math.sqrt(x * x + y * y);
    }
        // This should not happen, but I am having trouble with NaN camera parameters.
    if (s0 < 2 || s1 < 2) {
      return;
    }
    scale = s1 / s0;

        // scale is around the mid point .....
        // we need to compute focal point height and roll (not just a matrix).
        // Focal point is the only difficult item.
    var cam = this.GetCamera();
    w0[0] = cam.FocalPoint[0] - w1[0];
    w0[1] = cam.FocalPoint[1] - w1[1];
        // This is the new focal point.
    x = w1[0] + w0[0] / scale;
    y = w1[1] + w0[1] / scale;

        // Remember the last motion to implement momentum.
    var momentumScale = (scale - 1) / dt;

    this.MomentumX = 0.0;
    this.MomentumY = 0.0;
    this.MomentumRoll = 0.0;
    this.MomentumScale = (this.MomentumScale + momentumScale) * 0.5;

    cam.FocalPoint[0] = x;
    cam.FocalPoint[1] = y;
    cam.SetHeight(cam.GetHeight() / scale);
    cam.ComputeMatrix();
    this.EventuallyRender(true);
  };

  Viewer.prototype.HandleTouchEnd = function (event) {
    if (!this.InteractionEnabled) { return true; }

    // Let the annotation layers have first dibs on processing the event.
    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleTouchEnd && !layer.HandleTouchEnd(event)) {
        return false;
      }
    }

    // Code from a conflict
    var t = new Date().getTime();
    this.LastTime = this.Time;
    this.Time = t;

    var k = Math.min(this.Time - this.LastTime, 250) / 250;

    this.MomentumX = this.MomentumX * (1 - k);
    this.MomentumY = this.MomentumY * (1 - k);
    this.MomentumRoll = this.MomentumRoll * (1 - k);
    this.MomentumScale = this.MomentumScale * (1 - k);

    t = t - this.StartTouchTime;
    if (event.targetTouches.length === 0 && SAM.MOBILE_DEVICE) {
      this.StartTouchTime = 0;
      if (t < 90) {
        // We should not have a navigation widget on mobile
        // devices. (maybe iPad?).
        if (SA.display && SA.display.NavigationWidget) {
          SA.display.NavigationWidget.ToggleVisibility();
        }
        if (typeof (SA.MOBILE_ANNOTATION_WIDGET) !== 'undefined') {
          SA.MOBILE_ANNOTATION_WIDGET.ToggleVisibility();
        }
        return;
      }
      if (this.ActiveWidget !== null) {
        this.ActiveWidget.HandleTouchEnd(event);
        return;
      }
      // this.UpdateZoomGui();
      this.HandleMomentum();
    }
    // end conflict

    // this.UpdateZoomGui();
    this.HandleMomentum(event);

    // Use this as a flag to indicate ongoing interation (sweep, next
    // note .
    this.StartTouchTime = 0;
  };

  Viewer.prototype.HandleMomentum = function () {
    var self = this;
    // I see an odd intermittent camera matrix problem
    // on the iPad that looks like a thread safety issue.
    if (this.MomentumTimerId) {
      window.cancelAnimationFrame(this.MomentumTimerId);
      this.MomentumTimerId = 0;
    }

    var t = new Date().getTime();
    if (t - this.LastTime < 50) {
      this.MomentumTimerId = window.requestAnimationFrame(function () { self.HandleMomentum(); });
      return;
    }

    // Integrate the momentum.
    this.LastTime = this.Time;
    this.Time = t;
    var dt = this.Time - this.LastTime;

    var k = 200.0;
    var decay = Math.exp(-dt / k);
    var integ = (-k * decay + k);

    var cam = this.MainView.Camera;
    cam.Translate(-(this.MomentumX * integ), -(this.MomentumY * integ), 0);
    cam.SetHeight(cam.Height / ((this.MomentumScale * integ) + 1));
    cam.Roll = cam.Roll - (this.MomentumRoll * integ);
    cam.ComputeMatrix();
    if (this.OverView) {
      var cam2 = this.OverView.Camera;
      cam2.Roll = cam.Roll;
      cam2.ComputeMatrix();
    }
    // I think the problem with the ipad is thie asynchronous render.
    // Maybe two renders occur at the same time.
    // this.EventuallyRender();
    this.Draw();

    // Decay the momentum.
    this.MomentumX *= decay;
    this.MomentumY *= decay;
    this.MomentumScale *= decay;
    this.MomentumRoll *= decay;

    if (Math.abs(this.MomentumX) < 0.01 && Math.abs(this.MomentumY) < 0.01 &&
            Math.abs(this.MomentumRoll) < 0.0002 && Math.abs(this.MomentumScale) < 0.00005) {
      // Change is small. Stop the motion.
      this.MomentumTimerId = 0;
      if (this.InteractionState !== INTERACTION_NONE) {
        this.InteractionState = INTERACTION_NONE;
        if (SA.RECORDER_WIDGET) {
          SA.RECORDER_WIDGET.RecordState();
        }
      }
      this.UpdateZoomGui();
    } else {
      this.MomentumTimerId = window.requestAnimationFrame(function () { self.HandleMomentum(); });
    }
  };

  Viewer.prototype.ConstrainCamera = function () {
    var bounds = this.GetOverViewBounds();
    if (!bounds) {
      // Cache has not been set.
      return;
    }
    var spacing = this.MainView.GetLeafSpacing();
    var viewport = this.MainView.GetViewport();
    var cam = this.MainView.Camera;

    var modified = false;
    if (cam.FocalPoint[0] < bounds[0]) {
      cam.SetFocalPoint([bounds[0], cam.FocalPoint[1]]);
      modified = true;
    }
    if (cam.FocalPoint[0] > bounds[1]) {
      cam.SetFocalPoint([bounds[1], cam.FocalPoint[1]]);
      modified = true;
    }
    if (cam.FocalPoint[1] < bounds[2]) {
      cam.SetFocalPoint([cam.FocalPoint[0], bounds[2]]);
      modified = true;
    }
    if (cam.FocalPoint[1] > bounds[3]) {
      cam.SetFocalPoint([cam.FocalPoint[0], bounds[3]]);
      modified = true;
    }
    var heightMax = 2 * (bounds[3] - bounds[2]);
    if (cam.GetHeight() > heightMax) {
      cam.SetHeight(heightMax);
            // this.ZoomTarget = heightMax;
      modified = true;
    }
    var heightMin = viewport[3] * spacing * this.MinPixelSize;
    if (cam.GetHeight() < heightMin) {
      cam.SetHeight(heightMin);
            // this.ZoomTarget = heightMin;
      modified = true;
    }
    if (modified) {
      cam.ComputeMatrix();
    }
  };

  Viewer.prototype.HandleMouseDown = function (event) {
    if (!this.InteractionEnabled) { return true; }

    this.FireFoxWhich = event.which;
    event.preventDefault(); // Keep browser from selecting images.
    this.RecordMouseDown(event);

    if (this.RotateIconDrag) {
      // Problem with leaving the browser with mouse down.
      // This is a mouse down outside the icon, so the mouse must
      // have been let up and we did not get the event.
      this.RotateIconDrag = false;
    }

    if (this.DoubleClick) {
      // Without this, double click selects sub elementes.
      event.preventDefault();
      return this.HandleDoubleClick(event);
    }

    // Let the annotation layers have first dibs on processing the event.
    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleMouseDown && !layer.HandleMouseDown(event)) {
        return false;
      }
    }

    // Choose what interaction will be performed.
    if (event.which === 1) {
      if (event.ctrlKey) {
        if (this.Rotatable) { this.InteractionState = INTERACTION_ROTATE; }
      } else if (event.altKey) {
        this.InteractionState = INTERACTION_ZOOM;
      } else {
        this.InteractionState = INTERACTION_DRAG;
      }
      return false;
    }
    if (event.which === 2 && this.Rotatble) {
      this.InteractionState = INTERACTION_ROTATE;
      return false;
    }
    return true;
  };

  Viewer.prototype.HandleDoubleClick = function (event) {
    if (!this.InteractionEnabled) { return true; }

    // Let the annotation layers have first dibs on processing the event.
    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleDoubleClick && !layer.HandleDoubleClick(event)) {
        return false;
      }
    }

    var mWorld = this.ConvertPointViewerToWorld(event.offsetX, event.offsetY);
    if (event.which === 1) {
      this.AnimateZoomTo(0.5, mWorld);
    } else if (event.which === 3) {
      this.AnimateZoomTo(2.0, mWorld);
    }
    return true;
  };

  Viewer.prototype.HandleMouseUp = function (event) {
    if (!this.InteractionEnabled) { return true; }
    var date = new Date();
    this.MouseUpTime = date.getTime();
    this.FireFoxWhich = 0;
    this.RecordMouseUp(event);

    if (this.Rotatable && this.RotateIconDrag) {
      this.RollUp(event);
      return false;
    }

    // Let the annotation layers have first dibs on processing the event.
    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleMouseUp && !layer.HandleMouseUp(event)) {
        this.InteractionState = INTERACTION_NONE;
        return false;
      }
    }

    if (this.InteractionState === INTERACTION_OVERVIEW ||
        this.InteractionState === INTERACTION_OVERVIEW_DRAG) {
      return this.HandleOverViewMouseUp(event);
    }

    if (this.InteractionState !== INTERACTION_NONE) {
      this.InteractionState = INTERACTION_NONE;
      if (SA.RECORDER_WIDGET) {
        SA.RECORDER_WIDGET.RecordState();
      }
    }

    return false; // trying to keep the browser from selecting images
  };

  Viewer.prototype.HandleMouseMove = function (event) {
    if (!this.InteractionEnabled) { return true; }

    // The event position is relative to the target which can be a tab on
    // top of the canvas.  Just skip these events.
    if ($(event.target).width() !== $(event.currentTarget).width()) {
      return true;
    }

    if (!this.RecordMouseMove(event)) { return true; }

    // I think we need to deal with the move here because the mouse can
    // exit the icon and the events are lost.
    if (this.Rotatable && this.RotateIconDrag) {
      this.RollMove(event);
      return false;
    }

    // Let the annotation layers have first dibs on processing the event.
    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleMouseMove && !layer.HandleMouseMove(event)) {
        return false;
      }
    }

    if (this.InteractionState === INTERACTION_OVERVIEW ||
        this.InteractionState === INTERACTION_OVERVIEW_DRAG) {
      return this.HandleOverViewMouseMove(event);
    }

    if (this.InteractionState === INTERACTION_NONE) {
            // Allow the ResizePanel drag to process the events.
      return true;
    }

    var x = event.offsetX;
    var y = event.offsetY;
    var dx;
    var dy;

    // Drag camera in main view.
    // Dragging is too slow.  I want to accelerate dragging the further
    // this mouse moves.  This is a moderate change, so I am
    // going to try to accelerate with speed.
    if (this.InteractionState === INTERACTION_ROTATE) {
            // Rotate
            // Origin in the center.
            // GLOBAL GL will use view's viewport instead.
      var cx = x - (this.MainView.Viewport[2] * 0.5);
      var cy = y - (this.MainView.Viewport[3] * 0.5);
            // GLOBAL views will go away when views handle this.
      this.MainView.Camera.HandleRoll(cx, cy,
                                            this.MouseDeltaX,
                                            this.MouseDeltaY);
      this.RollTarget = this.MainView.Camera.Roll;
      this.UpdateCamera();
    } else if (this.InteractionState === INTERACTION_ZOOM) {
      dy = this.MouseDeltaY / this.MainView.Viewport[2];
      this.MainView.Camera.SetHeight(this.MainView.Camera.GetHeight() /
                                           (1.0 + (dy * 5.0)));
      this.ZoomTarget = this.MainView.Camera.GetHeight();
      this.UpdateCamera();
    } else if (this.InteractionState === INTERACTION_DRAG) {
            // Translate
            // Convert to view [-0.5,0.5] coordinate system.
            // Note: the origin gets subtracted out in delta above.
      dx = -this.MouseDeltaX / this.MainView.Viewport[2];
      dy = -this.MouseDeltaY / this.MainView.Viewport[2];
            // compute the speed of the movement.
      var speed = Math.sqrt(dx * dx + dy * dy) / this.MouseDeltaTime;
      speed = 1.0 + speed * 1000; // f(0) = 1 and increasing.
            // I am not sure I like the speed acceleration.
            // Lets try a limit.
      if (speed > 3.0) { speed = 3.0; }
      dx = dx * speed;
      dy = dy * speed;
      this.MainView.Camera.HandleTranslate(dx, dy, 0.0);
      this.ConstrainCamera();
    }
        // The only interaction that does not go through animate camera.
    this.TriggerInteraction();
    this.EventuallyRender(true);

    x = event.offsetX;
    y = event.offsetY;

    return false;
  };

  Viewer.prototype.HandleMouseWheel = function (event) {
    if (!this.InteractionEnabled) { return true; }

    if (!event.offsetX) {
      // for firefox
      event.offsetX = event.layerX;
      event.offsetY = event.layerY;
    }

    // Let the annotation layers have first dibs on processing the event.
    for (var i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleMouseWheel && !layer.HandleMouseWheel(event)) {
        return false;
      }
    }

    // We want to accumulate the target, but not the duration.
    var tmp = 0;
    if (event.deltaY) {
      tmp = event.deltaY;
    } else if (event.wheelDelta) {
      tmp = event.wheelDelta;
    }
    // Wheel event seems to be in increments of 3.
    // depreciated mousewheel had increments of 120....
    // Initial delta cause another bug.
    // Lets restrict to one zoom step per event.
    if (tmp > 0) {
      this.ZoomTarget *= 1.1;
    } else if (tmp < 0) {
      this.ZoomTarget /= 1.1;
    }

    // Compute translate target to keep position in the same place.
    // this.TranslateTarget[0] = this.MainView.Camera.FocalPoint[0];
    // this.TranslateTarget[1] = this.MainView.Camera.FocalPoint[1];
    var position = this.ConvertPointViewerToWorld(event.offsetX, event.offsetY);
    var factor = this.ZoomTarget / this.MainView.Camera.GetHeight();
    this.TranslateTarget[0] = position[0] -
            factor * (position[0] - this.MainView.Camera.FocalPoint[0]);
    this.TranslateTarget[1] = position[1] -
            factor * (position[1] - this.MainView.Camera.FocalPoint[1]);

    this.RollTarget = this.MainView.Camera.Roll;

    this.AnimateLast = new Date().getTime();
    this.AnimateDuration = 200.0; // hard code 200 milliseconds
    this.EventuallyRender(true);
    return false;
  };

  // Special one time function for paper analysis.
  Viewer.prototype.SegmentationsToCsv = function () {
    var note = SA.display.NavigationWidget.GetNote();
    // first collect a set of segmentation labels.
    var labels = {};
    var labelArray = [];
    var label;
    var i;
    var j;
    for (i = 0; i < note.ViewerRecords.length; ++i) {
      var annotations = note.ViewerRecords[i].Annotations;
      for (j = 0; j < annotations.length; ++j) {
        var annot = annotations[j];
        if (annot.type === 'polyline' && annot.text) {
          if (!labels[annot.text]) {
            labelArray.push(annot.text);
            labels[annot.text] = {area: 0.0, perimeter: 0.0};
          }
        }
      }
    }

    // Make a row for each section
    var widget = new SAM.PolylineWidget(SA.VIEWER1.GetAnnotationLayer(), false);
    for (i = 0; i < note.ViewerRecords.length; ++i) {
      var viewerRecord = note.ViewerRecords[i];
      for (j = 0; j < labelArray.length; ++j) {
        label = labelArray[j];
        labels[label].area = 0.0;
        labels[label].perimeter = 0.0;
      }
      for (j = 0; j < viewerRecord.Annotations.length; ++j) {
        annot = viewerRecord.Annotations[j];
        if (annot.type === 'polyline' && annot.text) {
          widget.Load(annot);
          widget.Polyline.Closed = true;
          labels[annot.text].area += widget.ComputeArea() * 0.25 * 0.25;
          labels[annot.text].perimeter += widget.ComputeLength() * 0.25;
        }
      }
    }
  };

  // returns false if the event was "consumed" (browser convention).
  // Returns true if nothing was done with the event.
  Viewer.prototype.HandleKeyDown = function (event) {
    if (!this.InteractionEnabled) { return true; }

    // Key events are not going first to layers like mouse events.
    // Give layers a change to process them.
    for (var i = 0; i < this.Layers.length; ++i) {
      if (this.Layers[i].HandleKeyDown && !this.Layers[i].HandleKeyDown(event)) {
        return false;
      }
    }

    // Linking polyline segmentations in a stack.
    // if (event.keyCode === 81) {
    //    SA.SegmentationSequenceLabel = prompt("Enter a segmentation label");
    // }
    // if (event.keyCode === 87 && SA.SegmentationSequenceLabel) {
    //    var layer = this.GetAnnotationLayer();
    //    //var note = SA.display.NavigationWidget.GetNote();
    //    if (layer.ActiveWidget && layer.ActiveWidget.Type === "polyline") {
    //        var widget = layer.ActiveWidget;
    //        widget.InitializeText();
    //        widget.Text.String = SA.SegmentationSequenceLabel;
    //    }
    //    SA.display.NavigationWidget.NextNote();
    // }

    if (event.keyCode === 83 && event.ctrlKey) { // control -s to save.
      if (!SAVING_IMAGE) {
        SAVING_IMAGE = new SAM.Dialog();
        SAVING_IMAGE.Title.text('Saving');
        SAVING_IMAGE.Body.css({'margin': '1em 2em'});
        SAVING_IMAGE.WaitingImage = $('<img>')
                    .appendTo(SAVING_IMAGE.Body)
                    .attr('src', SA.ImagePathUrl + 'circular.gif')
                    .attr('alt', 'waiting...')
                    .addClass('sa-view-save');
        SAVING_IMAGE.ApplyButton.hide();
        SAVING_IMAGE.SavingFlag = false;
        SAVING_IMAGE.Count = 0;
      }
      if (!SAVING_IMAGE.SavingFlag) {
        SAVING_IMAGE.SavingFlag = true;
        SAVING_IMAGE.Show(1);
        this.EventuallySaveImage(
          'slideAtlas' + SA.ZERO_PAD(SAVING_IMAGE.Count, 3),
           function () {
             SAVING_IMAGE.SavingFlag = false;
             SAVING_IMAGE.Count += 1;
             SAVING_IMAGE.Hide();
           }
         );
      }

      return false;
    }

    // Handle paste
    if (event.keyCode === 79) {
            // o to print out world mouse location for debugging.
      var wPt = this.ConvertPointViewerToWorld(this.LastMouseX, this.LastMouseY);
      console.log('World: ' + wPt[0] + ', ' + wPt[1]);
    }

    // Handle paste
    if (event.keyCode === 86 && event.ctrlKey) {
      // control-v for paste

      if (localStorage.ClipBoard === undefined) {
        console.log('Clipboard Empty');
      }

      var clip = JSON.parse(localStorage.ClipBoard);
      var camera;
      if (clip.Camera) {
        camera = new SAM.Camera();
        camera.Load(clip.Camera);
      }
      var widget;
      if (clip.Type === 'CircleWidget') {
        widget = new SAM.CircleWidget(this.GetAnnotationLayer(), false);
        widget.PasteCallback(clip.Data, this.GetAnnotationLayer().MouseWorld, camera);
      }
      if (clip.Type === 'PolylineWidget') {
        widget = new SAM.PolylineWidget(this.GetAnnotationLayer(), false);
        widget.PasteCallback(clip.Data, this.GetAnnotationLayer().MouseWorld, camera);
      }
      if (clip.Type === 'TextWidget') {
        widget = new SAM.TextWidget(this.GetAnnotationLayer(), '');
        widget.PasteCallback(clip.Data, this.GetAnnotationLayer().MouseWorld, camera);
      }
      if (clip.Type === 'RectWidget') {
        widget = new SAM.RectWidget(this.GetAnnotationLayer(), '');
        widget.PasteCallback(clip.Data, this.MouseWorld, camera);
      }
      if (clip.Type === 'GridWidget') {
        widget = new SAM.GridWidget(this.GetAnnotationLayer(), '');
        widget.PasteCallback(clip.Data, this.MouseWorld, camera);
      }

      return false;
    }

    if (String.fromCharCode(event.keyCode) === 'R') {
            // this.MainView.Camera.Reset();
      this.MainView.Camera.ComputeMatrix();
      this.ZoomTarget = this.MainView.Camera.GetHeight();
      this.EventuallyRender(true);
      return false;
    }

    var cam;
    var c;
    var s;
    var dx;
    var dy;
    var rx;
    var ry;
    if (event.keyCode === 38) {
      // Up cursor key
      cam = this.GetCamera();
      c = Math.cos(cam.Roll);
      s = -Math.sin(cam.Roll);
      dx = 0.0;
      dy = -0.8 * cam.GetHeight();
      rx = dx * c - dy * s;
      ry = dx * s + dy * c;
      this.TranslateTarget[0] = cam.FocalPoint[0] + rx;
      this.TranslateTarget[1] = cam.FocalPoint[1] + ry;
      this.AnimateLast = new Date().getTime();
      this.AnimateDuration = 200.0;
      this.EventuallyRender(true);
      return false;
    } else if (event.keyCode === 40) {
      // Down cursor key
      cam = this.GetCamera();
      c = Math.cos(cam.Roll);
      s = -Math.sin(cam.Roll);
      dx = 0.0;
      dy = 0.8 * cam.GetHeight();
      rx = dx * c - dy * s;
      ry = dx * s + dy * c;
      this.TranslateTarget[0] = cam.FocalPoint[0] + rx;
      this.TranslateTarget[1] = cam.FocalPoint[1] + ry;
      this.AnimateLast = new Date().getTime();
      this.AnimateDuration = 200.0;
      this.EventuallyRender(true);
      return false;
    } else if (event.keyCode === 37) {
      // Left cursor key
      cam = this.GetCamera();
      c = Math.cos(cam.Roll);
      s = -Math.sin(cam.Roll);
      dx = -0.8 * cam.GetWidth();
      dy = 0.0;
      rx = dx * c - dy * s;
      ry = dx * s + dy * c;
      this.TranslateTarget[0] = cam.FocalPoint[0] + rx;
      this.TranslateTarget[1] = cam.FocalPoint[1] + ry;
      this.AnimateLast = new Date().getTime();
      this.AnimateDuration = 200.0;
      this.EventuallyRender(true);
      return false;
    } else if (event.keyCode === 39) {
      // Right cursor key
      cam = this.GetCamera();
      c = Math.cos(cam.Roll);
      s = -Math.sin(cam.Roll);
      dx = 0.8 * cam.GetWidth();
      dy = 0.0;
      rx = dx * c - dy * s;
      ry = dx * s + dy * c;
      this.TranslateTarget[0] = cam.FocalPoint[0] + rx;
      this.TranslateTarget[1] = cam.FocalPoint[1] + ry;
      this.AnimateLast = new Date().getTime();
      this.AnimateDuration = 200.0;
      this.EventuallyRender(true);
      return false;
    }
    // hack to get copy working
    var layer = this.GetAnnotationLayer();
    if (layer) {
      if (!layer.HandleKeyDown(event)) {
        return false;
      }
    }

    if (event.keyCode === 27 && this.EscapeCallback) {
      this.EscapeCallback();
    }

    return true;
  };

  // returns false if the event was "consumed" (browser convention).
  // Returns true if nothing was done with the event.
  Viewer.prototype.HandleKeyUp = function (event) {
    if (!this.InteractionEnabled) { return true; }

    // Let the annotation layers have first dibs on processing the event.
    var i;
    for (i = 0; i < this.Layers.length; ++i) {
      var layer = this.Layers[i];
      if (layer.HandleKeyUp && !layer.HandleKeyUp(event)) {
        return false;
      }
    }

    // Key events are not going first to layers like mouse events.
    // Give layers a change to process them.
    for (i = 0; i < this.Layers.length; ++i) {
      if (this.Layers[i].HandleKeyUp && !this.Layers[i].HandleKeyUp(event)) {
        return false;
      }
    }
    return true;
  };

  // Get the current scale factor between pixels and world units.
  Viewer.prototype.GetPixelsPerUnit = function () {
    return this.MainView.GetPixelsPerUnit();
  };

  Viewer.prototype.GetMetersPerUnit = function () {
    return this.MainView.GetMetersPerUnit();
  };

  // Covert a point from world coordiante system to viewer coordinate system (units pixels).
  Viewer.prototype.ConvertPointWorldToViewer = function (x, y) {
    var cam = this.MainView.Camera;
    return cam.ConvertPointWorldToViewer(x, y);
  };

  Viewer.prototype.ConvertPointViewerToWorld = function (x, y) {
    var cam = this.MainView.Camera;
    return cam.ConvertPointViewerToWorld(x, y);
  };

  // ==============================================================================
  // OverView slide widget stuff.

  Viewer.prototype.OverViewCheckActive = function (event) {
    if (!this.OverView) {
      return false;
    }
    var x = event.offsetX;
    var y = event.offsetY;
    // Half height and width
    var hw = this.OverViewport[2] / 2;
    var hh = this.OverViewport[3] / 2;
    // Center of the overview.
    var cx = this.OverViewport[0] + hw;
    var cy = this.OverViewport[1] + hh;

    x = x - cx;
    y = y - cy;
    // Rotate into overview slide coordinates.
    var roll = this.MainView.Camera.Roll;
    var c = Math.cos(roll);
    var s = Math.sin(roll);
    var nx = Math.abs(c * x + s * y);
    var ny = Math.abs(c * y - s * x);
    if ((Math.abs(hw - nx) < 5 && ny < hh) ||
            (Math.abs(hh - ny) < 5 && nx < hw)) {
      this.OverViewActive = true;
      this.OverView.CanvasDiv.addClass('sa-view-overview-canvas sa-active');
    } else {
      this.OverViewActive = false;
      this.OverView.CanvasDiv.removeClass('sa-view-overview-canvas sa-active');
    }
    // return this.OverViewActive;
  };

  // Interaction events that change the main camera.

  // Resize of overview window will be drag with left mouse.
  // Reposition camera with left click (no drag).
  // Removing drag camera in overview.

  // TODO: Make the overview slide a widget.
  Viewer.prototype.HandleOverViewMouseDown = function (event) {
    if (!this.InteractionEnabled) { return true; }
    if (this.RotateIconDrag) { return; }

    this.InteractionState = INTERACTION_OVERVIEW;

    // Delay actions until we see if it is a drag or click.
    this.OverviewEventX = event.pageX;
    this.OverviewEventY = event.pageY;

    return false;
  };

  Viewer.prototype.HandleOverViewMouseUp = function (event) {
    if (!this.InteractionEnabled) { return true; }
    if (this.RotateIconDrag) { return; }
    if (this.InteractionState === INTERACTION_OVERVIEW_DRAG) {
      this.InteractionState = INTERACTION_NONE;
      return;
    }

    // This target for animation is not implemented cleanly.
    // This fixes a bug: OverView translated rotates camamera back to zero.
    this.RollTarget = this.MainView.Camera.Roll;

    if (event.which === 1) {
      var x = event.offsetX;
      var y = event.offsetY;
      if (x === undefined) { x = event.layerX; }
      if (y === undefined) { y = event.layerY; }
      // Transform to view's coordinate system.
      this.OverViewPlaceCamera(x, y);
    }

    this.InteractionState = INTERACTION_NONE;

    return false;
  };

  Viewer.prototype.HandleOverViewMouseMove = function (event) {
    if (!this.InteractionEnabled) { return true; }
    if (this.RotateIconDrag) {
      this.RollMove(event);
      return false;
    }

    var w;
    var p;
    if (this.InteractionState === INTERACTION_OVERVIEW) {
      // Do not start dragging until the mouse has moved some distance.
      if (Math.abs(event.pageX - this.OverviewEventX) > 5 ||
                Math.abs(event.pageY - this.OverviewEventY) > 5) {
                // Start dragging the overview window.
        this.InteractionState = INTERACTION_OVERVIEW_DRAG;
        w = this.GetViewport()[2];
        p = Math.max(w - event.pageX, event.pageY);
        this.OverViewScaleLast = p;
      }
      return false;
    }

    // This consumes events even when I return true. Why?
    if (this.InteractionState !== INTERACTION_OVERVIEW_DRAG) {
      // Drag originated outside overview.
      // Could be panning.
      return true;
    }

    // Drag to change overview size
    w = this.GetViewport()[2];
    p = Math.max(w - event.pageX, event.pageY);
    var d = p / this.OverViewScaleLast;
    this.OverViewScale *= d * d;
    this.OverViewScaleLast = p;
    if (p < 60) {
      this.RotateIcon.hide();
    } else {
      if (this.Rotatable) { this.RotateIcon.show(); }
    }

    this.UpdateSize();

    return false;
  };

  Viewer.prototype.HandleOverViewMouseWheel = function (event) {
    if (!this.InteractionEnabled) { return true; }
    var tmp = 0;
    if (event.deltaY) {
      tmp = event.deltaY;
    } else if (event.wheelDelta) {
      tmp = event.wheelDelta;
    }

    if (tmp > 0) {
      this.OverViewScale *= 1.2;
    } else if (tmp < 0) {
      this.OverViewScale /= 1.2;
    }

    this.UpdateSize();

    return true;
  };

  // TODO: Get rid of this function.
  // AnnotationWidget should not be here either.
  Viewer.prototype.SetAnnotationWidgetVisibility = function (vis) {
    if (this.Layers.length === 0) { return; }
    var layer = this.GetAnnotationLayer();
    if (!layer) { return; }
    if (vis) {
      if (!layer.AnnotationWidget) {
        layer.AnnotationWidget = new SA.AnnotationWidget(layer);
      }
      layer.AnnotationWidget.show();
    } else {
      if (layer.AnnotationWidget) {
        layer.AnnotationWidget.hide();
      }
    }
  };

  Viewer.prototype.SetZoomWidgetVisibility = function (vis) {
    if (vis) {
      if (!this.ZoomTab) {
        this.InitializeZoomGui();
      }
      this.ZoomTab.show();
    } else {
      if (this.ZoomTab) {
        this.ZoomTab.hide();
      }
    }
  };

  Viewer.prototype.SetCopyrightVisibility = function (vis) {
    if (vis) {
      this.CopyrightWrapper.show();
    } else {
      this.CopyrightWrapper.hide();
    }
  };

  // ------------------------------------------------------
  // Access methods for vigilant

  Viewer.prototype.GetNumberOfLayers = function () {
    return this.Layers.length;
  };
  Viewer.prototype.GetLayer = function (idx) {
    if (idx >= 0 && idx < this.Layers.length) {
      return this.Layers[idx];
    }
    return null;
  };

  Viewer.prototype.NewAnnotationLayer = function () {
    // Create an annotation layer by default.
    var annotationLayer = new SAM.AnnotationLayer(this.Div);
    this.AddLayer(annotationLayer);
    // TODO: Get rid of this.  master view is passed to draw.
    // Hack so the scale widget can get the spacing.
    annotationLayer.ScaleWidget.View = this.MainView;
    // Hack only used for girder testing.
    annotationLayer.Viewer = this;
    annotationLayer.UpdateSize();

    return annotationLayer;
  };

  Viewer.prototype.NewViewLayer = function () {
    // Create an annotation layer by default.
    var viewLayer = new SA.TileView(this.Div, false);
    this.AddLayer(viewLayer);
    viewLayer.UpdateSize();

    return viewLayer;
  };

  // Get rid of this.
  Viewer.prototype.ClearAnnotations = function () {
    var annotationLayer = this.GetAnnotationLayer();
    if (annotationLayer) {
      annotationLayer.Reset();
      annotationLayer.EventuallyDraw();
    }
  };

  // Get rid of this.
  // Access methods for vigilant
  Viewer.prototype.AddAnnotation = function (obj) {
    var annotationLayer = this.GetAnnotationLayer();
    if (annotationLayer) {
      annotationLayer.EventuallyDraw();
      return annotationLayer.LoadWidget(obj);
    }
  };
  // ------------------------------------------------------

  SA.Viewer = Viewer;
})();
